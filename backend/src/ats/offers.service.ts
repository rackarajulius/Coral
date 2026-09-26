import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { CompanyAuditCategory, OfferStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { CompanyAuditService } from '../company/company-audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../common/types/user.types';
import { OfferSignalsService } from './offer-signals.service';

export interface OfferInput {
  salaryAmount?: number | null;
  salaryCurrency?: string;
  salaryPeriod?: string | null;
  startDate?: string | null;
  expiresAt?: string | null;
  message?: string | null;
  internalNotes?: string | null;
}

/**
 * Offers of employment — the last stage of hiring.
 *
 * Until now the pipeline stopped at the interview and everything after it
 * happened in email, so the platform could not answer "did we ever make them an
 * offer, and what did they say?". That question is the whole point of an ATS.
 *
 * An offer is deliberately a draft first. Composing salary and start date is
 * not the same act as telling someone, and a tool that sends the moment you
 * type is a tool people compose in a text editor instead.
 */
@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly audit: CompanyAuditService,
    private readonly notifications: NotificationsService,
    private readonly signals: OfferSignalsService,
  ) {}

  /** Every offer the company has out, newest first. */
  async list(user: User, status?: OfferStatus) {
    const context = await this.companyContext.requireForUser(user.id);
    const offers = await this.prisma.offer.findMany({
      where: { companyId: context.companyId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        application: {
          select: {
            id: true,
            applicant: { select: { id: true, displayName: true, firstName: true, lastName: true } },
            job: { select: { id: true, title: true } },
          },
        },
      },
    });
    return offers.map((o) => this.shape(o));
  }

  async getForApplication(user: User, applicationId: string) {
    const context = await this.companyContext.requireForUser(user.id);
    await this.assertApplicationBelongsToCompany(context.memberUserIds, applicationId);
    const offer = await this.prisma.offer.findUnique({
      where: { applicationId },
      include: {
        application: {
          select: {
            id: true,
            applicant: { select: { id: true, displayName: true, firstName: true, lastName: true } },
            job: { select: { id: true, title: true } },
          },
        },
      },
    });
    return offer ? this.shape(offer) : null;
  }

  /** Creates or replaces the draft for an application. */
  async upsertDraft(user: User, applicationId: string, input: OfferInput) {
    const context = await this.companyContext.requireForUser(user.id);
    await this.assertApplicationBelongsToCompany(context.memberUserIds, applicationId);

    const existing = await this.prisma.offer.findUnique({ where: { applicationId } });
    if (existing && existing.status !== OfferStatus.DRAFT) {
      throw new BadRequestException(
        'This offer has already been sent. Withdraw it before writing a new one.',
      );
    }

    const data = this.normalize(input);
    const offer = await this.prisma.offer.upsert({
      where: { applicationId },
      create: { applicationId, companyId: context.companyId, createdById: user.id, ...data },
      update: data,
    });
    return { id: offer.id, status: offer.status };
  }

  /**
   * Sends the offer to the candidate.
   *
   * Notifies them in-app rather than only by email, because an offer that lands
   * in a spam folder is the most expensive message in hiring to lose.
   */
  async send(user: User, offerId: string) {
    const { offer, context } = await this.requireCompanyOffer(user, offerId);
    if (offer.status !== OfferStatus.DRAFT) {
      throw new BadRequestException('Only a draft can be sent.');
    }
    if (offer.expiresAt && offer.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('That deadline has already passed. Update it before sending.');
    }

    const updated = await this.prisma.offer.update({
      where: { id: offerId },
      data: { status: OfferStatus.SENT, sentAt: new Date() },
      include: { application: { select: { applicantId: true, job: { select: { title: true } } } } },
    });

    await this.notify(
      updated.application.applicantId,
      'You have an offer',
      `${context.companyName} has made you an offer for ${updated.application.job.title}.`,
    );
    await this.recordAudit(user, context.companyId, offerId, 'Offer sent', 'An offer was sent.');
    // Frozen as they stood now: what the outcomes report later compares against.
    await this.signals.snapshot(offerId);
    return { id: offerId, status: updated.status };
  }

  /** The employer pulls it back. The candidate is told — silence would be worse. */
  async withdraw(user: User, offerId: string) {
    const { offer, context } = await this.requireCompanyOffer(user, offerId);
    if (offer.status !== OfferStatus.SENT) {
      throw new BadRequestException('Only a sent offer can be withdrawn.');
    }
    await this.prisma.offer.update({
      where: { id: offerId },
      data: { status: OfferStatus.WITHDRAWN, respondedAt: new Date() },
    });

    const application = await this.prisma.application.findUnique({
      where: { id: offer.applicationId },
      select: { applicantId: true, job: { select: { title: true } } },
    });
    if (application) {
      await this.notify(
        application.applicantId,
        'An offer was withdrawn',
        `${context.companyName} has withdrawn its offer for ${application.job.title}.`,
      );
    }
    await this.recordAudit(user, context.companyId, offerId, 'Offer withdrawn', 'An offer was withdrawn.');
    return { id: offerId, status: OfferStatus.WITHDRAWN };
  }

  /* ------------------------------ candidate side ---------------------------- */

  /** What the candidate sees. `internalNotes` is never included. */
  async listForCandidate(user: User) {
    const offers = await this.prisma.offer.findMany({
      where: {
        application: { applicantId: user.id },
        // A draft is the employer thinking, not an offer. The candidate must
        // not learn one exists before it is deliberately sent.
        status: { not: OfferStatus.DRAFT },
      },
      orderBy: { sentAt: 'desc' },
      include: {
        application: { select: { job: { select: { id: true, title: true } } } },
        company: { select: { name: true } },
      },
    });

    return offers.map((o) => ({
      id: o.id,
      status: o.status,
      company: o.company.name,
      jobId: o.application.job.id,
      jobTitle: o.application.job.title,
      salaryAmount: o.salaryAmount,
      salaryCurrency: o.salaryCurrency,
      salaryPeriod: o.salaryPeriod,
      startDate: o.startDate,
      expiresAt: o.expiresAt,
      message: o.message,
      sentAt: o.sentAt,
      respondedAt: o.respondedAt,
    }));
  }

  async respond(user: User, offerId: string, accept: boolean) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        application: { select: { applicantId: true, jobId: true, job: { select: { title: true, postedById: true } } } },
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.application.applicantId !== user.id) {
      throw new ForbiddenException('That offer is not yours.');
    }
    if (offer.status !== OfferStatus.SENT) {
      throw new BadRequestException('That offer is no longer open.');
    }
    if (offer.expiresAt && offer.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('That offer has expired.');
    }

    const status = accept ? OfferStatus.ACCEPTED : OfferStatus.DECLINED;
    await this.prisma.$transaction([
      this.prisma.offer.update({
        where: { id: offerId },
        data: { status, respondedAt: new Date() },
      }),
      // The pipeline should not still say "interviewing" after someone accepts.
      this.prisma.application.update({
        where: { id: offer.applicationId },
        data: { status: accept ? 'hired' : 'rejected' },
      }),
    ]);

    await this.notify(
      offer.application.job.postedById,
      accept ? 'Offer accepted' : 'Offer declined',
      `Your offer for ${offer.application.job.title} was ${accept ? 'accepted' : 'declined'}.`,
    );
    return { id: offerId, status };
  }

  /**
   * Lapses offers past their deadline.
   *
   * Without this a passed deadline is only enforced when someone happens to
   * open the offer, so a stale "awaiting response" sits in the employer's list
   * indefinitely.
   */
  @ExclusiveCron(CronExpression.EVERY_HOUR, { name: 'offer-expiry' })
  async sweepExpired(): Promise<void> {
    try {
      const result = await this.prisma.offer.updateMany({
        where: { status: OfferStatus.SENT, expiresAt: { lt: new Date() } },
        data: { status: OfferStatus.EXPIRED },
      });
      if (result.count > 0) this.logger.log(`Expired ${result.count} offer(s).`);
    } catch (err) {
      this.logger.error(`Offer expiry sweep failed: ${(err as Error).message}`);
    }
  }

  /* --------------------------------- helpers -------------------------------- */

  private normalize(input: OfferInput) {
    const amount = input.salaryAmount;
    if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
      throw new BadRequestException('Salary must be a positive amount.');
    }
    return {
      salaryAmount: amount ?? null,
      salaryCurrency: (input.salaryCurrency ?? 'cad').toLowerCase(),
      salaryPeriod: input.salaryPeriod ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      message: input.message?.trim() || null,
      internalNotes: input.internalNotes?.trim() || null,
    };
  }

  private shape(offer: {
    id: string;
    status: OfferStatus;
    salaryAmount: number | null;
    salaryCurrency: string;
    salaryPeriod: string | null;
    startDate: Date | null;
    expiresAt: Date | null;
    message: string | null;
    internalNotes: string | null;
    sentAt: Date | null;
    respondedAt: Date | null;
    application: {
      id: string;
      applicant: { id: string; displayName: string | null; firstName: string | null; lastName: string | null };
      job: { id: string; title: string };
    };
  }) {
    const a = offer.application.applicant;
    return {
      id: offer.id,
      status: offer.status,
      applicationId: offer.application.id,
      candidateId: a.id,
      candidateName:
        a.displayName?.trim() || [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || 'Candidate',
      jobId: offer.application.job.id,
      jobTitle: offer.application.job.title,
      salaryAmount: offer.salaryAmount,
      salaryCurrency: offer.salaryCurrency,
      salaryPeriod: offer.salaryPeriod,
      startDate: offer.startDate,
      expiresAt: offer.expiresAt,
      message: offer.message,
      internalNotes: offer.internalNotes,
      sentAt: offer.sentAt,
      respondedAt: offer.respondedAt,
    };
  }

  private async assertApplicationBelongsToCompany(memberUserIds: string[], applicationId: string) {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, job: { postedById: { in: memberUserIds } } },
      select: { id: true },
    });
    if (!application) throw new NotFoundException('Application not found');
  }

  private async requireCompanyOffer(user: User, offerId: string) {
    const context = await this.companyContext.requireForUser(user.id);
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer || offer.companyId !== context.companyId) {
      throw new NotFoundException('Offer not found');
    }
    return { offer, context };
  }

  /** Never fails the action it describes. */
  private async notify(userId: string, title: string, body: string) {
    try {
      await this.notifications.create({ userId, type: 'offer', title, message: body });
    } catch (err) {
      this.logger.warn(`Offer notification failed: ${(err as Error).message}`);
    }
  }

  private async recordAudit(
    user: User,
    companyId: string,
    offerId: string,
    action: string,
    summary: string,
  ) {
    // No candidate name: this log exports to CSV and leaves the app.
    await this.audit.recordFor(user, {
      category: CompanyAuditCategory.CANDIDATES,
      action,
      entityType: 'offer',
      entityId: offerId,
      summary,
    });
  }
}
