import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { CompanyMemberStatus, CompanyRole, OfferStatus, SubscriptionStatus } from '@prisma/client';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { publicImageUrl } from '../common/public-image-url';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';
import { personName } from '../common/person-name';
import { LIVE_JOB_STATUSES } from '../jobs/job-lifecycle.service';
import { CompanyContextService } from './company-context.service';
import { CompanyAuditService } from './company-audit.service';

/** How long a deletion waits after the owner asks, during which they can call it off. */
export const DELETION_GRACE_DAYS = 30;

/**
 * Taking a company page down and bringing it back — LinkedIn's "Deactivate
 * page", which only a super admin may use. Here that is the company's owner.
 *
 * Deactivating hides the page (it 404s, and leaves search, the directory and
 * @mentions), closes the company's live jobs so nobody applies to a company
 * that has gone quiet, and stops anyone posting for it. Nothing is deleted:
 * reactivating brings the page back at the same address with its followers.
 * Closed jobs stay closed — reopening each one is a decision about that job.
 *
 * A deactivated page can also be deleted for good: the owner asks, and 30 days
 * later it goes (purgeDueCompanies). Until then they can cancel, or reactivate,
 * which cancels it. Jobs are kept, closed, with the company's name stamped on
 * them, so candidates' application history still says where they applied.
 */
@Injectable()
export class CompanyStatusService {
  private readonly logger = new Logger(CompanyStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly audit: CompanyAuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Whether the page is down, and whether this person may change that. */
  async status(user: User) {
    const context = await this.companyContext.requireForUser(user.id);
    const company = await this.prisma.company.findUnique({
      where: { id: context.companyId },
      select: { name: true, deactivatedAt: true, deletesAt: true },
    });
    return {
      companyName: company?.name ?? context.companyName,
      deactivatedAt: company?.deactivatedAt ?? null,
      /** When the page will be deleted for good; null unless the owner asked. */
      deletesAt: company?.deletesAt ?? null,
      canManage: context.role === CompanyRole.OWNER,
    };
  }

  async deactivate(user: User) {
    const context = await this.requireOwner(user);
    const company = await this.prisma.company.findUnique({
      where: { id: context.companyId },
      select: { name: true, deactivatedAt: true },
    });
    if (company?.deactivatedAt) return { ...(await this.status(user)), jobsClosed: 0 };

    const jobsClosed = await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: context.companyId },
        data: { deactivatedAt: new Date(), deactivatedById: user.id },
      });
      // Every member's live jobs, the fan-out rule: they are the company's.
      const closed = await tx.job.updateMany({
        where: { postedById: { in: context.memberUserIds }, status: { in: LIVE_JOB_STATUSES } },
        data: { status: 'closed' },
      });
      return closed.count;
    });

    const name = personName(user, 'Someone');
    await this.audit.record({
      companyId: context.companyId,
      actor: { id: user.id, name },
      category: 'COMPANY',
      action: 'Deactivated company page',
      entityType: 'company',
      entityId: context.companyId,
      entityName: company?.name ?? context.companyName,
      summary: `${name} deactivated the company page and closed ${jobsClosed} live job${jobsClosed === 1 ? '' : 's'}.`,
    });
    return { ...(await this.status(user)), jobsClosed };
  }

  async reactivate(user: User) {
    const context = await this.requireOwner(user);
    const company = await this.prisma.company.update({
      where: { id: context.companyId },
      // Reactivating also calls off a scheduled deletion.
      data: { deactivatedAt: null, deactivatedById: null, deletesAt: null, deletionRequestedById: null },
      select: { name: true },
    });
    const name = personName(user, 'Someone');
    await this.audit.record({
      companyId: context.companyId,
      actor: { id: user.id, name },
      category: 'COMPANY',
      action: 'Reactivated company page',
      entityType: 'company',
      entityId: context.companyId,
      entityName: company.name,
      summary: `${name} reactivated the company page.`,
    });
    return this.status(user);
  }

  /**
   * What stops a company being deleted right now, in words the owner can act
   * on. Checked when the owner asks and again when the day comes.
   *
   * - A paid plan: deleting our record would not stop Stripe charging.
   * - An offer still waiting for an answer: the candidate would be left with
   *   an offer from a company that no longer exists.
   */
  async deletionBlockers(companyId: string): Promise<string[]> {
    const [subscription, openOffers] = await Promise.all([
      this.prisma.companySubscription.findUnique({ where: { companyId }, select: { status: true } }),
      this.prisma.offer.count({ where: { companyId, status: OfferStatus.SENT } }),
    ]);
    const blockers: string[] = [];
    const paying: SubscriptionStatus[] = [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE];
    if (subscription && paying.includes(subscription.status)) {
      blockers.push('Cancel your paid plan in Billing first.');
    }
    if (openOffers > 0) {
      blockers.push(
        `${openOffers} offer${openOffers === 1 ? ' is' : 's are'} still waiting for a candidate's answer. Withdraw ${openOffers === 1 ? 'it' : 'them'} or wait for an answer.`,
      );
    }
    return blockers;
  }

  /**
   * The owner asks for the deactivated page to be deleted for good. It goes
   * in 30 days; they confirm by typing the company's name.
   */
  async scheduleDeletion(user: User, confirmName: string) {
    const context = await this.requireOwner(user);
    const company = await this.prisma.company.findUnique({
      where: { id: context.companyId },
      select: { name: true, deactivatedAt: true, deletesAt: true },
    });
    if (!company) throw new BadRequestException('Company not found.');
    if (!company.deactivatedAt) {
      throw new BadRequestException('Deactivate the page first. A page is deleted only after it has been taken down.');
    }
    if ((confirmName ?? '').trim().toLowerCase() !== company.name.trim().toLowerCase()) {
      throw new BadRequestException(`Type the company's name, ${company.name}, to confirm.`);
    }
    const blockers = await this.deletionBlockers(context.companyId);
    if (blockers.length > 0) throw new BadRequestException(blockers.join(' '));

    if (!company.deletesAt) {
      const deletesAt = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
      await this.prisma.company.update({
        where: { id: context.companyId },
        data: { deletesAt, deletionRequestedById: user.id },
      });
      const name = personName(user, 'Someone');
      await this.audit.record({
        companyId: context.companyId,
        actor: { id: user.id, name },
        category: 'COMPANY',
        action: 'Scheduled company page deletion',
        entityType: 'company',
        entityId: context.companyId,
        entityName: company.name,
        summary: `${name} asked for the company page to be deleted for good on ${deletesAt.toISOString().slice(0, 10)}.`,
      });
    }
    return this.status(user);
  }

  /** Calls off a scheduled deletion. The page stays deactivated. */
  async cancelDeletion(user: User) {
    const context = await this.requireOwner(user);
    const company = await this.prisma.company.update({
      where: { id: context.companyId },
      data: { deletesAt: null, deletionRequestedById: null },
      select: { name: true },
    });
    const name = personName(user, 'Someone');
    await this.audit.record({
      companyId: context.companyId,
      actor: { id: user.id, name },
      category: 'COMPANY',
      action: 'Cancelled company page deletion',
      entityType: 'company',
      entityId: context.companyId,
      entityName: company.name,
      summary: `${name} called off the company page's deletion. It stays deactivated.`,
    });
    return this.status(user);
  }

  /** Deletes every company whose 30 days are up, once a day. */
  @ExclusiveCron(CronExpression.EVERY_DAY_AT_3AM, { name: 'company-page-purge' })
  async purgeDueCompanies(): Promise<void> {
    const due = await this.prisma.company.findMany({
      where: { deletesAt: { lte: new Date() }, deactivatedAt: { not: null } },
      select: { id: true },
      take: 50,
    });
    for (const { id } of due) {
      await this.deleteCompanyNow(id).catch((err) =>
        this.logger.error(`Deleting company ${id} failed: ${(err as Error).message}`),
      );
    }
  }

  /**
   * Deletes one company for good, if it is due and nothing stands in the way.
   *
   * Kept, so candidates' records still make sense: every job the company's
   * people posted, closed, with the company's name and logo stamped on it.
   * Deleted: the page (its branding, followers and address, which is freed),
   * the company's posts — left alone they would turn into personal posts by
   * whoever wrote them — and the company record with everything that hangs
   * off it: seats, invitations, notes, tags, decided offers, events, templates.
   * Members keep their own accounts; their own profile rows go private, so
   * none of them resurfaces as a stand-in for the company.
   *
   * Returns whether it was deleted.
   */
  async deleteCompanyNow(companyId: string): Promise<boolean> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true, name: true, pageId: true, deletesAt: true, deactivatedAt: true, deletionRequestedById: true,
        page: { select: { companyLogo: true } },
      },
    });
    if (!company?.deletesAt || !company.deactivatedAt || company.deletesAt > new Date()) return false;

    const blockers = await this.deletionBlockers(companyId);
    if (blockers.length > 0) {
      // Not today: tell whoever asked what is in the way, and try again tomorrow.
      if (company.deletionRequestedById) {
        await this.notifications.create({
          userId: company.deletionRequestedById,
          type: 'system',
          title: `${company.name}'s page wasn't deleted yet`,
          message: `${blockers.join(' ')} We'll try again tomorrow.`,
          link: '/employers/settings/general',
        }).catch(() => undefined);
      }
      return false;
    }

    // Whose jobs are this company's: members whose oldest membership is it
    // (the rule their jobs are shown under), the fan-out statuses.
    const members = await this.prisma.companyMember.findMany({
      where: {
        companyId,
        status: { in: [CompanyMemberStatus.ACTIVE, CompanyMemberStatus.SUSPENDED, CompanyMemberStatus.REMOVED] },
      },
      select: { userId: true },
    });
    const posters: string[] = [];
    for (const { userId } of members) {
      const first = await this.prisma.companyMember.findFirst({
        where: { userId, status: { not: CompanyMemberStatus.PENDING } },
        orderBy: { createdAt: 'asc' },
        select: { companyId: true },
      });
      if (first?.companyId === companyId) posters.push(userId);
    }
    const logo = publicImageUrl(company.page?.companyLogo);

    await this.prisma.$transaction(async (tx) => {
      if (posters.length > 0) {
        await tx.job.updateMany({
          where: { postedById: { in: posters }, companyName: null },
          data: { companyName: company.name },
        });
        if (logo) {
          await tx.job.updateMany({
            where: { postedById: { in: posters }, companyLogo: null },
            data: { companyLogo: logo },
          });
        }
        await tx.job.updateMany({
          where: { postedById: { in: posters }, status: { in: LIVE_JOB_STATUSES } },
          data: { status: 'closed' },
        });
      }
      await tx.post.deleteMany({ where: { companyId } });
      await tx.employerProfile.updateMany({
        where: { companyId, ...(company.pageId ? { id: { not: company.pageId } } : {}) },
        data: { visibility: 'private', companyId: null },
      });
      if (company.pageId) await tx.employerProfile.delete({ where: { id: company.pageId } });
      await tx.company.delete({ where: { id: companyId } });
    }, { timeout: 60_000 });

    this.logger.log(`Deleted company ${companyId} (${company.name}) for good`);
    if (company.deletionRequestedById) {
      await this.notifications.create({
        userId: company.deletionRequestedById,
        type: 'system',
        title: `${company.name}'s page was deleted`,
        message: 'Its page, posts and team are gone. Its jobs stay closed in candidates\' history under its name.',
        link: '/notifications',
      }).catch(() => undefined);
    }
    return true;
  }

  private async requireOwner(user: User) {
    const context = await this.companyContext.requireForUser(user.id);
    if (context.role !== CompanyRole.OWNER) {
      throw new ForbiddenException("Only the company's owner can deactivate or reactivate its page.");
    }
    return context;
  }
}
