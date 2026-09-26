import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export const ANALYTICS_EVENT_TYPES = [
  'profile_view',
  'job_view',
  'apply_click',
  'apply_started',
  /** First view of an employer's page in a session; carries the true referrer. */
  'page_source',
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

const DAY_MS = 86_400_000;
const DEFAULT_RETENTION_DAYS = 90;

export interface RecordEventInput {
  type: AnalyticsEventType;
  /** Resolved by the caller from the job/profile — never from the client. */
  employerId: string;
  jobId?: string | null;
  viewerId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  referer?: string | null;
  /** Client-reported true referrer + campaign tags (page_source events). */
  referrerOverride?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  /** ISO-2 resolved from the edge header — never from a stored IP. */
  country?: string | null;
  /** Browser-reported IANA zone; coarse region fallback. */
  timezone?: string | null;
}

/**
 * Event capture for employer analytics.
 *
 * Two rules shape everything here:
 *
 * 1. **Recording never blocks a request.** A view is a side effect of someone
 *    reading a job page; a failure to log it must not fail the page.
 * 2. **Nothing identifying is stored.** Visitor counting needs to know that two
 *    hits are the same person *today*, not who they are — so we keep a salted
 *    day-scoped hash and never the IP.
 */
@Injectable()
export class AnalyticsEventsService {
  private readonly logger = new Logger(AnalyticsEventsService.name);

  /**
   * Process-lifetime salt when none is configured. A random salt means hashes
   * don't survive a restart (unique counts split across it), but the failure
   * mode of a *missing* salt is far worse: raw-ish hashes of IPs that could be
   * brute-forced back to addresses. Set ANALYTICS_SALT in production.
   */
  private readonly fallbackSalt = randomBytes(32).toString('hex');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Recently-seen (session, type, target) keys, for de-duplication.
   *
   * A refresh or a double-click shouldn't read as two visits, and without this
   * anyone could loop a request to inflate their own numbers — or a rival's.
   * In-memory, so it does NOT hold across instances or restarts; see the note
   * in the analytics plan about moving this to Redis if the API scales out.
   */
  private readonly recentKeys = new Map<string, number>();
  private readonly dedupeWindowMs = 30 * 60_000;

  /** True when this exact event was already counted inside the window. */
  private isDuplicate(key: string): boolean {
    const now = Date.now();
    // Opportunistic sweep — keeps the map from growing without bound.
    if (this.recentKeys.size > 10_000) {
      for (const [k, at] of this.recentKeys) {
        if (now - at > this.dedupeWindowMs) this.recentKeys.delete(k);
      }
    }
    const seen = this.recentKeys.get(key);
    if (seen !== undefined && now - seen < this.dedupeWindowMs) return true;
    this.recentKeys.set(key, now);
    return false;
  }

  /**
   * Records one event. Fire-and-forget by design — callers should not await
   * this on a user-facing path, and it never throws.
   */
  record(input: RecordEventInput): void {
    const session = this.sessionHash(input.ip, input.userAgent);
    if (session && this.isDuplicate(`${session}|${input.type}|${input.jobId ?? input.employerId}`)) {
      return;
    }
    void this.prisma.analyticsEvent
      .create({
        data: {
          type: input.type,
          employerId: input.employerId,
          jobId: input.jobId ?? null,
          viewerId: input.viewerId ?? null,
          sessionHash: session,
          // The client-reported referrer wins when present: for a single-page
          // app the request's own Referer header is our own url, so it says
          // nothing about where the visitor actually came from.
          source: input.referrerOverride
            ? this.refererHost(input.referrerOverride)
            : this.refererHost(input.referer),
          utmSource: this.tag(input.utmSource),
          utmMedium: this.tag(input.utmMedium),
          utmCampaign: this.tag(input.utmCampaign),
          country: input.country ?? null,
          timezone: input.timezone ?? null,
        },
      })
      .catch((err) => {
        this.logger.warn(`Failed to record ${input.type}: ${(err as Error).message}`);
      });
  }

  /**
   * Day-scoped, salted hash of the visitor's network fingerprint.
   *
   * Including the UTC day means the same visitor produces a different hash
   * tomorrow, so this cannot be used to follow someone over time even by us.
   */
  private sessionHash(ip?: string | null, userAgent?: string | null): string | null {
    if (!ip && !userAgent) return null;
    const salt = this.config.get<string>('ANALYTICS_SALT') || this.fallbackSalt;
    const day = new Date().toISOString().slice(0, 10);
    return createHash('sha256')
      .update(`${salt}|${day}|${ip ?? ''}|${userAgent ?? ''}`)
      .digest('hex')
      .slice(0, 32);
  }

  /** Bounded, trimmed campaign tag — these come straight off a URL. */
  private tag(value?: string | null): string | null {
    const v = (value ?? '').trim().slice(0, 100);
    return v.length > 0 ? v : null;
  }

  /**
   * Host only. A full referrer carries search terms and private path segments,
   * which we have no reason to keep just to say a visit came from LinkedIn.
   */
  private refererHost(referer?: string | null): string | null {
    if (!referer) return null;
    try {
      return new URL(referer).hostname.replace(/^www\./, '').slice(0, 100) || null;
    } catch {
      return null;
    }
  }

  /* ------------------------------- rollup -------------------------------- */

  /**
   * Aggregates a day's raw events into employer_metrics_daily.
   *
   * Runs for *yesterday* by default so it only ever processes a complete day —
   * rolling up today would write a partial figure that later looks like a dip.
   */
  @ExclusiveCron(CronExpression.EVERY_DAY_AT_2AM, { name: 'employer-metrics-rollup' })
  async rollupYesterday(): Promise<void> {
    const day = new Date(Date.now() - DAY_MS);
    try {
      const count = await this.rollupDay(day);
      this.logger.log(`Rolled up ${count} employer metric rows for ${this.dayKey(day)}`);
    } catch (err) {
      this.logger.error(`Metric rollup failed: ${(err as Error).message}`);
    }
  }

  /**
   * Rolls up one UTC day. Idempotent — re-running overwrites that day's row,
   * so a failed night can simply be re-run rather than double-counted.
   */
  async rollupDay(day: Date): Promise<number> {
    const start = this.startOfUtcDay(day);
    const end = new Date(start.getTime() + DAY_MS);

    const events = await this.prisma.analyticsEvent.findMany({
      where: { occurredAt: { gte: start, lt: end } },
      select: { employerId: true, type: true, sessionHash: true, viewerId: true },
    });
    if (events.length === 0) return 0;

    // Jobs the employer posted themselves: an employer opening their own job
    // shouldn't show up as audience.
    const owners = new Set(events.map((e) => e.employerId));
    const byEmployer = new Map<
      string,
      { profileViews: number; jobViews: number; applyClicks: number; applyStarted: number; visitors: Set<string> }
    >();

    for (const e of events) {
      if (e.viewerId && e.viewerId === e.employerId) continue; // self-view
      const row =
        byEmployer.get(e.employerId) ??
        { profileViews: 0, jobViews: 0, applyClicks: 0, applyStarted: 0, visitors: new Set<string>() };

      if (e.type === 'profile_view') row.profileViews++;
      else if (e.type === 'job_view') row.jobViews++;
      else if (e.type === 'apply_click') row.applyClicks++;
      else if (e.type === 'apply_started') row.applyStarted++;

      if (e.sessionHash) row.visitors.add(e.sessionHash);
      byEmployer.set(e.employerId, row);
    }
    void owners;

    const dayOnly = new Date(`${this.dayKey(day)}T00:00:00.000Z`);
    for (const [employerId, row] of byEmployer) {
      const data = {
        profileViews: row.profileViews,
        jobViews: row.jobViews,
        applyClicks: row.applyClicks,
        applyStarted: row.applyStarted,
        uniqueVisitors: row.visitors.size,
      };
      await this.prisma.employerMetricDaily.upsert({
        where: { employerId_day: { employerId, day: dayOnly } },
        create: { employerId, day: dayOnly, ...data },
        update: data,
      });
    }
    return byEmployer.size;
  }

  /* ------------------------------ retention ------------------------------ */

  /**
   * Raw events are only needed until they're rolled up. Keeping them forever
   * would grow without bound and retain visitor fingerprints long past any use.
   */
  @ExclusiveCron(CronExpression.EVERY_DAY_AT_4AM, { name: 'analytics-event-retention' })
  async pruneOldEvents(): Promise<void> {
    const days = Number(
      this.config.get<string>('ANALYTICS_EVENT_RETENTION_DAYS', String(DEFAULT_RETENTION_DAYS)),
    );
    const retention = Number.isFinite(days) && days >= 1 ? Math.floor(days) : DEFAULT_RETENTION_DAYS;
    const cutoff = new Date(Date.now() - retention * DAY_MS);

    try {
      const { count } = await this.prisma.analyticsEvent.deleteMany({
        where: { occurredAt: { lt: cutoff } },
      });
      if (count > 0) this.logger.log(`Pruned ${count} analytics events older than ${retention}d`);
    } catch (err) {
      this.logger.error(`Analytics event prune failed: ${(err as Error).message}`);
    }
  }

  private startOfUtcDay(d: Date): Date {
    return new Date(`${this.dayKey(d)}T00:00:00.000Z`);
  }

  private dayKey(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
