import { ForbiddenException, Injectable } from '@nestjs/common';
import { CompanyMemberStatus, CompanyRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CompanyContext {
  companyId: string;
  companyName: string;
  role: CompanyRole;
  /**
   * Every ACTIVE member's user id, including the caller.
   *
   * This is the fan-out key for shared visibility: an employer's jobs,
   * candidates and messages are all still keyed to the user who created them,
   * so "everything my company can see" is `IN (memberUserIds)`.
   */
  memberUserIds: string[];
}

/**
 * Resolves which company the caller is acting for.
 *
 * Every employer-facing query should scope through this rather than through the
 * caller's own user id. The two failure modes are opposite and both bad: scope
 * too narrowly and a teammate opens an empty dashboard; scope too widely and one
 * company reads another's applications. Keeping the resolution in one place
 * means the rule is written once.
 */
@Injectable()
export class CompanyContextService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Statuses whose records belong to the company.
   *
   * Wider than "may act": someone suspended or removed did their work on the
   * company's behalf, and the company must keep seeing it. PENDING is excluded
   * — they were never admitted, so nothing of theirs is the company's.
   */
  private static readonly VISIBLE_STATUSES = [
    CompanyMemberStatus.ACTIVE,
    CompanyMemberStatus.SUSPENDED,
    CompanyMemberStatus.REMOVED,
  ];

  /**
   * The caller's membership row whatever its status.
   *
   * Callers need to tell "never joined a company" from "joined and was
   * suspended" — the first is a sole operator with full rights over their own
   * data, the second must be able to do nothing at all.
   */
  async membershipFor(userId: string) {
    return this.prisma.companyMember.findFirst({
      where: { userId, status: { not: CompanyMemberStatus.PENDING } },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** The caller's company, or null if they aren't an active member of one. */
  async forUser(userId: string): Promise<CompanyContext | null> {
    const membership = await this.membershipFor(userId);
    if (!membership || membership.status !== CompanyMemberStatus.ACTIVE) return null;

    const members = await this.prisma.companyMember.findMany({
      where: {
        companyId: membership.companyId,
        status: { in: CompanyContextService.VISIBLE_STATUSES },
      },
      select: { userId: true },
    });

    return {
      companyId: membership.companyId,
      companyName: membership.company.name,
      role: membership.role,
      memberUserIds: members.map((m) => m.userId),
    };
  }

  async requireForUser(userId: string): Promise<CompanyContext> {
    const context = await this.forUser(userId);
    if (!context) {
      throw new ForbiddenException('You are not an active member of a company.');
    }
    return context;
  }

  /**
   * User ids whose records the caller may see.
   *
   * Falls back to the caller alone when they belong to no company — an employer
   * who signed up before teams existed, or whose membership is still pending,
   * keeps seeing exactly their own data rather than nothing.
   */
  async memberUserIds(userId: string): Promise<string[]> {
    const context = await this.forUser(userId);
    return context ? context.memberUserIds : [userId];
  }

  /** True when the caller may manage members, roles and invitations. */
  static canManageMembers(role: CompanyRole): boolean {
    return role === CompanyRole.OWNER || role === CompanyRole.ADMIN;
  }

  async assertCanManageMembers(userId: string): Promise<CompanyContext> {
    const context = await this.requireForUser(userId);
    if (!CompanyContextService.canManageMembers(context.role)) {
      throw new ForbiddenException('Only owners and admins can manage the team.');
    }
    return context;
  }
}
