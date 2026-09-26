import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MetricTrend {
  trend: number[];
  /** % change from the first to the last point in the window (0 if insufficient data). */
  change: number;
}

/**
 * Captures a daily point-in-time snapshot of key admin metrics so trend
 * sparklines and period-over-period change can be computed from real history.
 *
 * Scheduled daily at 01:00 via @nestjs/schedule, plus a catch-up capture on boot.
 * Captures are idempotent per (key, day) — a unique constraint plus upsert means
 * re-running (restart, double-fire, multiple instances) just refreshes today's value.
 */
@Injectable()
export class MetricSnapshotService implements OnModuleInit {
  private readonly logger = new Logger(MetricSnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Catch-up capture on boot in case the daily run was missed while down.
    await this.captureToday().catch((err) =>
      this.logger.error(`Initial metric snapshot failed: ${err?.message ?? err}`),
    );
  }

  @ExclusiveCron(CronExpression.EVERY_DAY_AT_1AM, { name: 'daily-metric-snapshot' })
  async scheduledCapture() {
    await this.captureToday().catch((err) =>
      this.logger.error(`Scheduled metric snapshot failed: ${err?.message ?? err}`),
    );
  }

  /** Today's date with the time zeroed out (matches the @db.Date column). */
  private today(): Date {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  /** Computes the current value of every tracked metric. */
  private async collectMetrics(): Promise<Record<string, number>> {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * DAY_MS);
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [
      employersTotal,
      employersActive,
      employersSuspended,
      employersVerified,
      jobseekersTotal,
      listingsActive,
      applicationsTotal,
      revenueMtd,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'EMPLOYER' } }),
      this.prisma.user.count({
        where: { role: 'EMPLOYER', postedJobs: { some: { publishedAt: { gte: last30Days } } } },
      }),
      this.prisma.user.count({ where: { role: 'EMPLOYER', status: 'SUSPENDED' } }),
      this.prisma.employerProfile.count({ where: { verificationStatus: 'verified' } }),
      this.prisma.user.count({ where: { role: 'JOB_SEEKER' } }),
      this.prisma.job.count({ where: { status: 'published' } }),
      this.prisma.application.count(),
      this.prisma.paymentTransaction.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID', paidAt: { gte: startOfMonth } },
      }),
    ]);

    return {
      'employers.total': employersTotal,
      'employers.active': employersActive,
      'employers.suspended': employersSuspended,
      'employers.verified': employersVerified,
      'employers.pending': Math.max(employersTotal - employersVerified, 0),
      'jobseekers.total': jobseekersTotal,
      'listings.active': listingsActive,
      'applications.total': applicationsTotal,
      'revenue.mtd': revenueMtd._sum.amount ?? 0,
    };
  }

  /** Upserts today's snapshot for every tracked metric (idempotent). */
  async captureToday(): Promise<void> {
    const capturedOn = this.today();
    const metrics = await this.collectMetrics();

    await Promise.all(
      Object.entries(metrics).map(([key, value]) =>
        this.prisma.metricSnapshot.upsert({
          where: { key_capturedOn: { key, capturedOn } },
          create: { key, value, capturedOn },
          update: { value },
        }),
      ),
    );

    this.logger.log(`Captured ${Object.keys(metrics).length} metric snapshots for ${capturedOn.toISOString().slice(0, 10)}`);
  }

  /**
   * Returns the last `days` snapshots for a metric as a trend array, plus the
   * % change from the oldest to newest point in the window. Returns an empty
   * trend when there isn't enough history yet — callers can fall back.
   */
  async getTrend(key: string, days = 7): Promise<MetricTrend> {
    const rows = await this.prisma.metricSnapshot.findMany({
      where: { key },
      orderBy: { capturedOn: 'desc' },
      take: days,
      select: { value: true },
    });

    if (rows.length === 0) return { trend: [], change: 0 };

    const trend = rows.map((r) => r.value).reverse(); // oldest → newest
    const first = trend[0];
    const last = trend[trend.length - 1];
    const change = first > 0 ? Math.round(((last - first) / first) * 100) : 0;

    return { trend, change };
  }

  /**
   * For cumulative metrics (e.g. total applications), returns the day-over-day
   * deltas — i.e. how many were added each day — instead of the running total.
   * Producing `days` deltas needs `days + 1` cumulative snapshots.
   */
  async getDeltaTrend(key: string, days = 7): Promise<MetricTrend> {
    const rows = await this.prisma.metricSnapshot.findMany({
      where: { key },
      orderBy: { capturedOn: 'desc' },
      take: days + 1,
      select: { value: true },
    });

    if (rows.length < 2) return { trend: [], change: 0 };

    const cumulative = rows.map((r) => r.value).reverse(); // oldest → newest
    const deltas: number[] = [];
    for (let i = 1; i < cumulative.length; i++) {
      deltas.push(Math.max(cumulative[i] - cumulative[i - 1], 0)); // clamp deletions to 0
    }

    const first = deltas[0];
    const last = deltas[deltas.length - 1];
    const change = first > 0 ? Math.round(((last - first) / first) * 100) : 0;

    return { trend: deltas, change };
  }
}
