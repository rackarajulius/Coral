import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { CompanyMemberStatus, CompanyRole, UserStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';
import { CompanyContextService } from './company-context.service';
import { CompanyEnrolmentService, EnrolmentResult } from './company-enrolment.service';
import { workDomain } from '../employers/onboarding.service';

/** Roles a link may grant. Never OWNER or ADMIN — mirrored by a CHECK constraint. */
export const LINK_ASSIGNABLE_ROLES: CompanyRole[] = [
  CompanyRole.RECRUITER,
  CompanyRole.HIRING_MANAGER,
  CompanyRole.INTERVIEWER,
  CompanyRole.VIEWER,
];

const DEFAULT_TTL_DAYS = 7;
const MAX_TTL_DAYS = 30;

/**
 * Shareable join links.
 *
 * The whole design rests on one idea: a link is a bearer token, so it must be
 * safe to lose. Off-domain holders are not refused — they are queued for the
 * approval a human already performs — which means an escaped link degrades into
 * the flow that already exists rather than into a breach.
 */
@Injectable()
export class CompanyJoinLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly config: ConfigService,
    private readonly enrolment: CompanyEnrolmentService,
  ) {}

  private url(token: string): string {
    const base = this.config.get<string>('FRONTEND_URL') || 'http://localhost:8081';
    return `${base}/employers/join?token=${token}`;
  }

  /** The company's live link, or null. Managers only — it is a credential. */
  async current(user: User) {
    const context = await this.companyContext.assertCanManageMembers(user.id);
    const link = await this.prisma.companyJoinLink.findFirst({
      where: { companyId: context.companyId, revokedAt: null },
    });
    if (!link) return null;

    const company = await this.prisma.company.findUnique({
      where: { id: context.companyId },
      select: { domain: true },
    });

    return {
      id: link.id,
      url: this.url(link.token),
      role: link.role,
      domainLocked: link.domainLocked,
      /**
       * Null when the company has no work domain. The UI must say so rather
       * than showing a lock that cannot engage — everyone using the link would
       * silently land in the approval queue instead.
       */
      domain: company?.domain ?? null,
      maxUses: link.maxUses,
      usedCount: link.usedCount,
      expiresAt: link.expiresAt,
      expired: link.expiresAt.getTime() < Date.now(),
      exhausted: link.maxUses != null && link.usedCount >= link.maxUses,
    };
  }

  /** Creates the link, revoking any previous one so only one is ever live. */
  async regenerate(
    user: User,
    dto: { role?: CompanyRole; domainLocked?: boolean; expiresInDays?: number; maxUses?: number },
  ) {
    const context = await this.companyContext.assertCanManageMembers(user.id);
    const role = dto.role ?? CompanyRole.RECRUITER;
    if (!LINK_ASSIGNABLE_ROLES.includes(role)) {
      throw new BadRequestException(
        'A join link cannot grant owner or admin. Promote someone individually instead.',
      );
    }

    const days = Math.min(Math.max(dto.expiresInDays ?? DEFAULT_TTL_DAYS, 1), MAX_TTL_DAYS);
    if (dto.maxUses != null && (dto.maxUses < 1 || dto.maxUses > 500)) {
      throw new BadRequestException('Set a use limit between 1 and 500, or leave it unlimited.');
    }

    // Revoke first: the partial unique index allows exactly one live link, and
    // regenerating is the only remedy for a link that has escaped.
    await this.prisma.companyJoinLink.updateMany({
      where: { companyId: context.companyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.prisma.companyJoinLink.create({
      data: {
        companyId: context.companyId,
        token: randomBytes(24).toString('base64url'),
        role,
        domainLocked: dto.domainLocked ?? true,
        maxUses: dto.maxUses ?? null,
        expiresAt: new Date(Date.now() + days * 86_400_000),
        createdById: user.id,
      },
    });

    return this.current(user);
  }

  async revoke(user: User) {
    const context = await this.companyContext.assertCanManageMembers(user.id);
    const { count } = await this.prisma.companyJoinLink.updateMany({
      where: { companyId: context.companyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw new NotFoundException('There is no active join link.');
    return { revoked: true };
  }

  /**
   * What the link is for, shown before someone commits to joining.
   *
   * Returns the company name and the seat only. Never the member list or
   * anything about candidates — the holder has proven nothing at this point.
   */
  async preview(token: string) {
    const link = await this.findUsableLink(token);
    const company = await this.prisma.company.findUnique({
      where: { id: link.companyId },
      select: { name: true, domain: true },
    });
    return {
      companyName: company?.name ?? 'this company',
      role: link.role,
      domainLocked: link.domainLocked,
      domain: company?.domain ?? null,
    };
  }

  async accept(user: User, token: string): Promise<EnrolmentResult> {
    const link = await this.findUsableLink(token);
    const company = await this.prisma.company.findUnique({
      where: { id: link.companyId },
      select: { id: true, name: true, domain: true },
    });
    if (!company) throw new NotFoundException('That company no longer exists.');

    const { status, pendingReason } = this.decideAdmission(link.domainLocked, company.domain, user);

    const result = await this.enrolment.enrol(user, {
      companyId: company.id,
      companyName: company.name,
      role: link.role,
      status,
      pendingReason,
      invitedById: link.createdById,
    });

    // Counted only for a join that actually seated someone — re-opening the
    // link when you are already a member must not burn a use.
    if (!result.alreadyMember) {
      await this.prisma.companyJoinLink.update({
        where: { id: link.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    return result;
  }

  /* ------------------------------- helpers -------------------------------- */

  /**
   * Admitted outright only when the address demonstrably belongs to the
   * company. Everything else queues for approval instead of being refused: a
   * contractor on a personal address is a normal case, and turning them away
   * would push companies to disable the lock entirely.
   */
  private decideAdmission(
    domainLocked: boolean,
    companyDomain: string | null,
    user: User,
  ): { status: Extract<CompanyMemberStatus, 'ACTIVE' | 'PENDING'>; pendingReason: string | null } {
    if (!domainLocked) {
      return { status: CompanyMemberStatus.ACTIVE, pendingReason: null };
    }
    if (!companyDomain) {
      return {
        status: CompanyMemberStatus.PENDING,
        pendingReason:
          'This company has no verified work domain, so joins are approved by an owner.',
      };
    }
    // Free-mail hosts return null here, so gmail.com can never match a company.
    if (workDomain(user.email) === companyDomain) {
      return { status: CompanyMemberStatus.ACTIVE, pendingReason: null };
    }
    return {
      status: CompanyMemberStatus.PENDING,
      pendingReason: `Your email isn't on @${companyDomain}, so an owner needs to approve you.`,
    };
  }

  private async findUsableLink(token: string) {
    // One message for every failure mode, including a missing token — a probe
    // must not learn whether a token existed, only that it does not work.
    const dead = new NotFoundException('That link has expired or is no longer valid.');
    if (!token?.trim()) throw dead;

    const link = await this.prisma.companyJoinLink.findUnique({ where: { token: token.trim() } });
    if (!link || link.revokedAt) throw dead;
    if (link.expiresAt.getTime() < Date.now()) throw dead;
    if (link.maxUses != null && link.usedCount >= link.maxUses) throw dead;
    return link;
  }
}
