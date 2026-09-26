import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from './settings.service';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AuditEntry {
  adminId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityName?: string | null;
  changeSummary?: string | null;
  status?: 'Success' | 'Failed';
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Nightly retention sweep: deletes audit rows older than the retention window
   * (admin-configurable, see SettingsService) so this append-only table stays
   * bounded. One indexed deleteMany on created_at (see @@index([createdAt])) —
   * cheap, and never throws.
   */
  @ExclusiveCron(CronExpression.EVERY_DAY_AT_3AM, { name: 'audit-log-retention' })
  async pruneOldLogs(): Promise<void> {
    const days = await this.settings.getAuditRetentionDays();
    const cutoff = new Date(Date.now() - days * DAY_MS);

    try {
      const { count } = await this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      if (count > 0) {
        this.logger.log(`Pruned ${count} audit log(s) older than ${days} days`);
      }
    } catch (err) {
      this.logger.error(
        `Audit log retention failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Persists one audit-trail row. Never throws — an audit failure must not
   * roll back or break the action that triggered it.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          adminId: entry.adminId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          entityName: entry.entityName ?? null,
          changeSummary: entry.changeSummary ?? null,
          status: entry.status ?? 'Success',
          before: entry.before ?? Prisma.JsonNull,
          after: entry.after ?? Prisma.JsonNull,
          ipAddress: entry.ipAddress ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Paginated audit feed, newest first, shaped for the admin UI. */
  async list(query: AuditLogsQueryDto = {}) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(query.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    const and: Prisma.AuditLogWhereInput[] = [];
    if (query.search?.trim()) {
      const s = query.search.trim();
      and.push({
        OR: [
          { entityName: { contains: s, mode: 'insensitive' } },
          { changeSummary: { contains: s, mode: 'insensitive' } },
          { entityId: { contains: s, mode: 'insensitive' } },
          { admin: { displayName: { contains: s, mode: 'insensitive' } } },
          { admin: { email: { contains: s, mode: 'insensitive' } } },
        ],
      });
    }
    if (query.action) and.push({ action: query.action });
    if (query.entityType) and.push({ entityType: query.entityType });
    if (query.status) and.push({ status: query.status });
    if (query.adminId) and.push({ adminId: query.adminId });

    const where: Prisma.AuditLogWhereInput = and.length ? { AND: and } : {};

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          admin: {
            select: { id: true, displayName: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const data = rows.map((r) => {
      const adminName =
        r.admin.displayName ||
        `${r.admin.firstName || ''} ${r.admin.lastName || ''}`.trim() ||
        r.admin.email;
      return {
        id: r.id,
        timestamp: r.createdAt.toISOString(),
        adminUser: adminName,
        adminAvatar: r.admin.avatarUrl || undefined,
        action: r.action,
        entityType: r.entityType,
        entityName: r.entityName || '—',
        entityId: r.entityId || '—',
        changeSummary: r.changeSummary || '',
        status: r.status,
        ipAddress: r.ipAddress || '—',
        source: 'Admin Panel' as const,
        requestId: `req_${r.id.slice(0, 8)}`,
        before: (r.before as Record<string, unknown> | null) ?? undefined,
        after: (r.after as Record<string, unknown> | null) ?? undefined,
      };
    });

    return { data, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } };
  }
}
