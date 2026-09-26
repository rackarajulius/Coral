import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { CompanyAuditCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from './company-context.service';
import { User } from '../common/types/user.types';

/** How long company audit entries are kept. */
const RETENTION_DAYS = 365;

export interface AuditEntryInput {
  companyId: string;
  /**
   * Null id for a non-human actor. The billing webhooks are the real case:
   * a renewal or a failed charge is Stripe acting, not a teammate, and
   * attributing it to whoever last opened the page would be a lie.
   */
  actor: { id: string | null; name: string };
  category: CompanyAuditCategory;
  /** Short verb phrase, e.g. "Changed role". */
  action: string;
  entityType?: string;
  entityId?: string;
  /**
   * Never a candidate's name. This log exports to CSV, so anything written
   * here leaves the app and stops being covered by access checks. Job titles
   * and teammate names are company data and fine; candidates get their id and
   * a neutral summary instead.
   */
  entityName?: string;
  summary: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

/**
 * The company's own activity trail.
 *
 * Recorded at the time of the action rather than derived later: a row only
 * holds its current state, so "who changed this role" cannot be answered after
 * the fact, and a deletion leaves nothing behind to reconstruct from.
 */
@Injectable()
export class CompanyAuditService {
  private readonly logger = new Logger(CompanyAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /**
   * Writes an entry. Never throws.
   *
   * An audit write must not be able to fail the action it describes — losing
   * one line of history is a far smaller problem than refusing a role change
   * because the log was unavailable.
   */
  async record(entry: AuditEntryInput): Promise<void> {
    try {
      await this.prisma.companyAuditLog.create({
        data: {
          companyId: entry.companyId,
          actorId: entry.actor.id,
          actorName: entry.actor.name,
          category: entry.category,
          action: entry.action,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          entityName: entry.entityName ?? null,
          summary: entry.summary,
          before: entry.before ?? Prisma.DbNull,
          after: entry.after ?? Prisma.DbNull,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write company audit entry: ${(err as Error).message}`);
    }
  }

  /**
   * Convenience for call sites that hold a User rather than a company id.
   * Resolves the company itself and does nothing when the actor is not in one.
   */
  async recordFor(
    user: User,
    entry: Omit<AuditEntryInput, 'companyId' | 'actor'>,
  ): Promise<void> {
    try {
      const context = await this.companyContext.forUser(user.id);
      if (!context) return;
      await this.record({
        ...entry,
        companyId: context.companyId,
        actor: { id: user.id, name: displayName(user) },
      });
    } catch (err) {
      this.logger.error(`Failed to resolve company for audit entry: ${(err as Error).message}`);
    }
  }

  /**
   * For call sites that only hold a user id — OAuth callbacks arrive with no
   * session, carrying just the id from their signed state.
   */
  async recordForUserId(
    userId: string,
    entry: Omit<AuditEntryInput, 'companyId' | 'actor'>,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true, firstName: true, lastName: true, email: true },
      });
      if (!user) return;
      await this.recordFor(user as User, entry);
    } catch (err) {
      this.logger.error(`Failed to resolve actor for audit entry: ${(err as Error).message}`);
    }
  }

  async list(
    user: User,
    query: {
      category?: CompanyAuditCategory;
      q?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    // Governance surface: owners and admins only, matching the Team tab.
    const context = await this.companyContext.assertCanManageMembers(user.id);

    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);

    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;
    // An inclusive end date: someone filtering "to the 5th" means the whole day.
    if (to) to.setHours(23, 59, 59, 999);

    const where: Prisma.CompanyAuditLogWhereInput = {
      companyId: context.companyId,
      ...(query.category ? { category: query.category } : {}),
      ...(from && !Number.isNaN(from.getTime()) ? { createdAt: { gte: from } } : {}),
      ...(to && !Number.isNaN(to.getTime())
        ? { createdAt: { ...(from ? { gte: from } : {}), lte: to } }
        : {}),
      ...(query.q?.trim()
        ? {
            OR: [
              { actorName: { contains: query.q.trim(), mode: 'insensitive' } },
              { summary: { contains: query.q.trim(), mode: 'insensitive' } },
              { entityName: { contains: query.q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.companyAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.companyAuditLog.count({ where }),
    ]);

    return {
      meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
      data: rows.map((r) => ({
        id: r.id,
        actorName: r.actorName,
        category: r.category,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        entityName: r.entityName,
        summary: r.summary,
        createdAt: r.createdAt,
      })),
    };
  }

  /** Nightly prune, mirroring the platform audit log's retention sweep. */
  @ExclusiveCron(CronExpression.EVERY_DAY_AT_3AM, { name: 'company-audit-retention' })
  async prune(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
    try {
      const { count } = await this.prisma.companyAuditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      if (count > 0) this.logger.log(`Pruned ${count} company audit entries older than ${RETENTION_DAYS} days.`);
    } catch (err) {
      this.logger.error(`Company audit retention failed: ${(err as Error).message}`);
    }
  }
}

export function displayName(user: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  return (
    user.displayName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.email ||
    'Someone'
  );
}
