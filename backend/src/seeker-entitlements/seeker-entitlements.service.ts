import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';
import { isPremiumEnforced, isPremiumUser } from '../auth/guards/premium.guard';
import {
  EntitlementBlock,
  SEEKER_METRICS,
  SEEKER_METRIC_KEYS,
  SeekerMetric,
  SeekerTier,
  windowEnd,
  windowStart,
} from './seeker-entitlements';
import { EntitlementException } from './entitlement.exception';

export interface MetricStatus {
  metric: SeekerMetric;
  label: string;
  window: 'day' | 'month';
  used: number;
  /** Null means unlimited. */
  limit: number | null;
  /** Null when there is nothing left to reset — unlimited, or not included. */
  resetsAt: string | null;
  /** Whether one more use fits the allowance. */
  allowed: boolean;
  /** Set only when not allowed. */
  reason: EntitlementBlock | null;
}

/**
 * Measures jobseeker usage against the tier registry.
 *
 * Usage is always counted. Refusing is separate, and only happens through
 * `assertAllowed` once `PREMIUM_ENFORCEMENT` is on — the same flag the Premium
 * guard honours. Before that the numbers are real and visible, which is what
 * lets pricing be set from actual usage instead of guesses.
 */
@Injectable()
export class SeekerEntitlementsService {
  private readonly logger = new Logger(SeekerEntitlementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  tierOf(user: User): SeekerTier {
    return isPremiumUser(user) ? 'premium' : 'free';
  }

  /** Whether limits are actually applied yet. */
  isEnforced(): boolean {
    return isPremiumEnforced(this.config);
  }

  async status(user: User, metric: SeekerMetric, at = new Date()): Promise<MetricStatus> {
    const rule = SEEKER_METRICS[metric];
    const limit = rule.limits[this.tierOf(user)];
    const periodStart = windowStart(rule.window, at);

    const row = await this.prisma.userUsage.findUnique({
      where: { userId_metric_periodStart: { userId: user.id, metric, periodStart } },
      select: { count: true },
    });
    const used = row?.count ?? 0;

    let reason: EntitlementBlock | null = null;
    if (limit === 0) reason = 'PREMIUM_REQUIRED';
    else if (limit !== null && used >= limit) reason = 'ALLOWANCE_EXHAUSTED';

    return {
      metric,
      label: rule.label,
      window: rule.window,
      used,
      limit,
      resetsAt: limit === null || limit === 0 ? null : windowEnd(rule.window, at).toISOString(),
      allowed: reason === null,
      reason,
    };
  }

  /**
   * Refuses when the allowance doesn't cover one more use — but only once
   * enforcement is switched on. Until then this measures nothing and blocks
   * nothing; `record` keeps counting either way.
   */
  async assertAllowed(user: User, metric: SeekerMetric): Promise<void> {
    if (!this.isEnforced()) return;
    const status = await this.status(user, metric);
    if (status.allowed) return;

    const rule = SEEKER_METRICS[metric];
    const tier = this.tierOf(user);
    const period = rule.window === 'day' ? "today's" : "this month's";

    let message: string;
    if (status.reason === 'PREMIUM_REQUIRED') {
      message = `Premium includes ${rule.noun}.`;
    } else if (tier === 'premium') {
      // A fair-use cap is not an upsell: there is nothing further to buy.
      message = `You've reached ${period} fair-use limit for ${rule.noun}.`;
    } else {
      message = `You've used ${period} free ${rule.noun}.`;
    }

    throw new EntitlementException({
      code: status.reason ?? 'ALLOWANCE_EXHAUSTED',
      metric,
      tier,
      resetsAt: status.resetsAt,
      message,
    });
  }

  /** Every metric at once, for the account's own usage view. */
  async snapshot(user: User) {
    const metrics = await Promise.all(SEEKER_METRIC_KEYS.map((m) => this.status(user, m)));
    return { tier: this.tierOf(user), enforced: this.isEnforced(), metrics };
  }

  /**
   * Counts one use. Awaited by callers, and never throws.
   *
   * An upsert with an atomic increment, so two uses at the same instant are
   * both counted. The first use in a window can still race another first use
   * on the unique index; that loser retries as a plain increment.
   */
  async record(userId: string, metric: SeekerMetric, at = new Date()): Promise<void> {
    const periodStart = windowStart(SEEKER_METRICS[metric].window, at);
    const where = { userId_metric_periodStart: { userId, metric, periodStart } };
    try {
      await this.prisma.userUsage.upsert({
        where,
        create: { userId, metric, periodStart, count: 1 },
        update: { count: { increment: 1 } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        await this.prisma.userUsage
          .update({ where, data: { count: { increment: 1 } } })
          .catch((retryError) => this.warn(metric, retryError));
        return;
      }
      // A missed count must never fail the thing the user actually asked for.
      this.warn(metric, error);
    }
  }

  private warn(metric: string, error: unknown) {
    this.logger.warn(
      `Could not record ${metric} usage: ${error instanceof Error ? error.message : 'unknown'}`,
    );
  }
}
