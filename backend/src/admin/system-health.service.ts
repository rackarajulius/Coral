import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronLeaseService } from '../common/scheduling/cron-lease.service';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

type ServiceStatus = 'operational' | 'degraded' | 'down';

export interface ServiceTile {
  name: string;
  status: ServiceStatus;
  latency: string;
}

@Injectable()
export class SystemHealthService {
  private readonly logger = new Logger(SystemHealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly leases: CronLeaseService,
  ) {}

  /** Live snapshot: real service probes, scheduler jobs, and DB/storage/account stats. */
  async getHealth() {
    const [db, authProbe, storage, accounts] = await Promise.all([
      this.checkDatabase(),
      this.checkAuth(),
      this.storage.healthCheck(),
      this.accountStats(),
    ]);

    const storageStatus: ServiceStatus = storage.ok
      ? storage.latencyMs && storage.latencyMs > 800
        ? 'degraded'
        : 'operational'
      : 'down';

    // Both are needed: without EMAIL_FROM every send throws, whatever the key.
    const emailConfigured =
      !!this.config.get<string>('RESEND_API_KEY') && !!this.config.get<string>('EMAIL_FROM', '').trim();
    const jobs = await this.listJobs();
    const failing = jobs.filter((j) => j.status === 'failed' || j.status === 'overdue').length;

    const services: ServiceTile[] = [
      { name: 'API', status: 'operational', latency: this.formatUptime(process.uptime()) },
      { name: 'Database', status: db.status, latency: db.latencyMs != null ? `${db.latencyMs}ms` : '—' },
      { name: 'Authentication', status: authProbe.status, latency: authProbe.latencyMs != null ? `${authProbe.latencyMs}ms` : '—' },
      { name: 'File Storage', status: storageStatus, latency: storage.latencyMs != null ? `${storage.latencyMs}ms` : '—' },
      { name: 'Email', status: emailConfigured ? 'operational' : 'down', latency: emailConfigured ? 'configured' : 'not set' },
      {
        name: 'Scheduler',
        status: jobs.length === 0 || failing > 0 ? 'degraded' : 'operational',
        latency: `${jobs.length} job${jobs.length === 1 ? '' : 's'}${failing ? ` · ${failing} failing` : ''}`,
      },
    ];

    return {
      generatedAt: new Date().toISOString(),
      services,
      database: {
        status: db.status,
        latencyMs: db.latencyMs,
        activeConnections: db.activeConnections,
        size: db.size,
      },
      storage: { status: storageStatus, buckets: storage.buckets, latencyMs: storage.latencyMs },
      accounts,
      jobs,
    };
  }

  /** Real auth/account signals from the User table. */
  private async accountStats() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [total, new24h, active24h, verified, suspendedOrBanned, admins] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.user.count({ where: { lastLoginAt: { gte: since } } }),
      this.prisma.user.count({ where: { emailVerified: true } }),
      this.prisma.user.count({ where: { status: { in: [UserStatus.SUSPENDED, UserStatus.BANNED] } } }),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
    ]);
    return {
      total,
      new24h,
      active24h,
      verifiedRate: total > 0 ? Math.round((verified / total) * 100) : 0,
      suspendedOrBanned,
      admins,
    };
  }

  private async checkDatabase() {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - started;

      let activeConnections: number | null = null;
      let size: string | null = null;
      try {
        const conn = await this.prisma.$queryRaw<Array<{ c: bigint }>>`
          SELECT count(*)::bigint AS c FROM pg_stat_activity WHERE datname = current_database()`;
        activeConnections = Number(conn[0]?.c ?? 0);
        const sz = await this.prisma.$queryRaw<Array<{ size: string }>>`
          SELECT pg_size_pretty(pg_database_size(current_database())) AS size`;
        size = sz[0]?.size ?? null;
      } catch (err) {
        this.logger.warn(`DB stat queries failed: ${err instanceof Error ? err.message : err}`);
      }

      const status: ServiceStatus = latencyMs > 250 ? 'degraded' : 'operational';
      return { status, latencyMs, activeConnections, size };
    } catch (err) {
      this.logger.error(`Database health check failed: ${err instanceof Error ? err.message : err}`);
      return { status: 'down' as ServiceStatus, latencyMs: null, activeConnections: null, size: null };
    }
  }

  private async checkAuth() {
    const url = this.config.get<string>('supabase.url');
    const anonKey = this.config.get<string>('supabase.anonKey');
    if (!url) return { status: 'down' as ServiceStatus, latencyMs: null };

    const started = Date.now();
    try {
      // GoTrue exposes an unauthenticated health endpoint.
      const res = await fetch(`${url}/auth/v1/health`, {
        headers: anonKey ? { apikey: anonKey } : {},
      });
      const latencyMs = Date.now() - started;
      if (!res.ok) return { status: 'degraded' as ServiceStatus, latencyMs };
      const status: ServiceStatus = latencyMs > 800 ? 'degraded' : 'operational';
      return { status, latencyMs };
    } catch (err) {
      this.logger.error(`Auth health check failed: ${err instanceof Error ? err.message : err}`);
      return { status: 'down' as ServiceStatus, latencyMs: null };
    }
  }

  /**
   * Scheduled jobs as the lease table records them — across every server.
   *
   * This used to read @nestjs/schedule's registry, which knows only this
   * server's timers: a job that failed, or ran on another server, showed as
   * "scheduled" with this server's last fire time. The lease table has the
   * real last run, its outcome and its error.
   */
  private async listJobs() {
    try {
      const rows = await this.leases.status();
      return rows.map((j) => ({
        name: this.prettifyJobName(j.name),
        key: j.name,
        status: j.status,
        lastRun: j.lastRun,
        nextRun: j.nextRun,
        lastError: j.lastError,
        lastDurationMs: j.lastDurationMs,
        consecutiveFailures: j.consecutiveFailures,
      }));
    } catch (err) {
      this.logger.error(`Could not read scheduled jobs: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  private prettifyJobName(name: string) {
    // Auto-generated registry keys are uuids — keep those raw; humanize named jobs.
    if (/^[0-9a-f-]{20,}$/i.test(name)) return name;
    return name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private formatUptime(seconds: number) {
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `up ${h}h ${m}m`;
    if (m > 0) return `up ${m}m`;
    return `up ${s}s`;
  }
}
