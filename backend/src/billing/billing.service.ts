import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyPlan, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { PlanPricingService } from './plan-pricing.service';
import { User } from '../common/types/user.types';
import { roleHasCapability } from '../company/capabilities';
import {
  AI_METRICS,
  AiMetric,
  PLAN_ENTITLEMENTS,
  PLAN_LABELS,
  entitlementsFor,
} from './plan-entitlements';

/** The window usage is counted against. */
interface UsagePeriod {
  start: Date;
  end: Date | null;
  /** True when it comes from Stripe rather than the calendar. */
  fromSubscription: boolean;
}

/**
 * What a company is paying for and what it has used.
 *
 * Two kinds of number live here and they are gathered differently on purpose.
 * Seats and active job posts are *derived* — counted from their own tables
 * every time, so they cannot disagree with reality. AI operations are
 * *accumulated*, because an AI call is an event that leaves nothing behind to
 * recount later.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly config: ConfigService,
    private readonly pricing: PlanPricingService,
  ) {}

  /**
   * Whether plan limits refuse the next action, or only display.
   *
   * Off until BILLING_ENFORCEMENT=true, mirroring PREMIUM_ENFORCEMENT: while no
   * company can pay yet, refusing would lock everyone to Starter's allowance.
   */
  enforcementOn(): boolean {
    return this.config.get<string>('BILLING_ENFORCEMENT') === 'true';
  }

  /**
   * Boosts started in the current period against the plan's allowance.
   *
   * Counted from JobBoost rows on read, like seats: a boost leaves a record, so
   * a stored counter would only be a second copy that could drift. A sole
   * operator with no company is counted by the boosts they started themselves.
   */
  async boostAllowance(userId: string): Promise<{
    used: number;
    limit: number | null;
    enforced: boolean;
    periodStart: Date;
    periodEnd: Date | null;
  }> {
    const context = await this.companyContext.forUser(userId);
    const subscription = context
      ? await this.prisma.companySubscription.findUnique({ where: { companyId: context.companyId } })
      : null;
    const period = this.periodFor(subscription);
    const used = await this.prisma.jobBoost.count({
      where: {
        ...(context ? { companyId: context.companyId } : { createdById: userId, companyId: null }),
        createdAt: { gte: period.start },
      },
    });
    return {
      used,
      limit: entitlementsFor(subscription?.plan ?? CompanyPlan.STARTER).boosts,
      enforced: this.enforcementOn(),
      periodStart: period.start,
      periodEnd: period.end,
    };
  }

  /**
   * The billing page's payload.
   *
   * Readable by any member, not just the owner: a recruiter needs to know they
   * are two job posts from the cap. It carries no payment data at all — no
   * card, no invoice, no Stripe id — so there is nothing here that a
   * non-owner should not see.
   */
  async overview(user: User) {
    const context = await this.companyContext.forUser(user.id);

    // A sole operator who predates teams, or someone mid-onboarding. Refusing
    // outright would lock them out of a page that should simply say so.
    if (!context) {
      return {
        company: null,
        reason: 'You are not part of a company yet, so there is nothing to bill.',
      };
    }

    const subscription = await this.prisma.companySubscription.findUnique({
      where: { companyId: context.companyId },
    });

    // Absent row means never subscribed. Synthesised rather than created: a GET
    // that writes would be a surprise, and STARTER needs no row to be true.
    const plan = subscription?.plan ?? CompanyPlan.STARTER;
    const status = subscription?.status ?? SubscriptionStatus.NONE;
    const period = this.periodFor(subscription);

    const [seatsUsed, activeJobsUsed, aiRows, boostsUsed] = await Promise.all([
      this.prisma.companyMember.count({
        where: { companyId: context.companyId, status: 'ACTIVE' },
      }),
      this.prisma.job.count({
        where: { postedById: { in: context.memberUserIds }, status: 'active' },
      }),
      this.prisma.companyUsage.findMany({
        where: {
          companyId: context.companyId,
          periodStart: period.start,
          metric: { in: [...AI_METRICS] },
        },
        select: { metric: true, count: true },
      }),
      this.prisma.jobBoost.count({
        where: { companyId: context.companyId, createdAt: { gte: period.start } },
      }),
    ]);

    const aiByMetric = Object.fromEntries(
      AI_METRICS.map((m) => [m, aiRows.find((r) => r.metric === m)?.count ?? 0]),
    ) as Record<AiMetric, number>;
    const aiUsed = Object.values(aiByMetric).reduce((a, b) => a + b, 0);

    const limits = entitlementsFor(plan);

    return {
      company: { id: context.companyId, name: context.companyName },
      viewerRole: context.role,
      /**
       * Derived here rather than in the UI so the button and the guard cannot
       * disagree — both read the same capability table.
       */
      canManageBilling: roleHasCapability(context.role, 'billing:manage'),
      /**
       * Whether a Stripe customer exists, as a boolean. The id itself is
       * payment data and stays server-side; the page only needs to know
       * whether the portal has anywhere to open.
       */
      hasBillingAccount: Boolean(subscription?.stripeCustomerId),
      plan: { id: plan, ...PLAN_LABELS[plan] },
      status,
      interval: subscription?.interval ?? null,
      currency: subscription?.currency ?? 'cad',
      /**
       * What Stripe charges per period, in the currency's smallest unit.
       * Null on a free plan — nothing is charged, which is not a charge of
       * zero, and the page shows no price at all rather than "$0.00".
       */
      unitAmount: subscription?.unitAmount ?? null,
      currentPeriodStart: subscription?.currentPeriodStart ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      /**
       * Which window the AI figure covers. Shown to the reader, because
       * "42 of 100 used" means different things over a calendar month and over
       * a billing period that started on the 12th.
       */
      usagePeriod: {
        start: period.start,
        end: period.end,
        basis: period.fromSubscription ? 'billing-period' : 'calendar-month',
      },
      usage: {
        seats: { used: seatsUsed, limit: limits.seats, basis: 'derived' },
        activeJobs: { used: activeJobsUsed, limit: limits.activeJobs, basis: 'derived' },
        aiOperations: {
          used: aiUsed,
          limit: limits.aiOperations,
          basis: 'metered',
          breakdown: aiByMetric,
        },
        boosts: { used: boostsUsed, limit: limits.boosts, basis: 'derived' },
      },
      features: limits.features,
    };
  }

  /**
   * The whole registry, so the UI cannot advertise a limit nothing enforces —
   * now including what each plan costs, read from the same Stripe price ids
   * checkout charges against. A plan cannot be sold at one price and
   * advertised at another.
   */
  async entitlements() {
    const pricing = await this.pricing.all();
    return {
      plans: (Object.keys(PLAN_ENTITLEMENTS) as CompanyPlan[]).map((id) => ({
        id,
        ...PLAN_LABELS[id],
        ...PLAN_ENTITLEMENTS[id],
        price: pricing[id],
      })),
    };
  }

  /**
   * Counts one AI operation against the company's allowance.
   *
   * Call this *after* the operation succeeds. A request that the vendor refused
   * with a quota error produced nothing, and charging for it would be charging
   * for our own outage.
   *
   * Never throws: a metering failure must not take down the feature it meters.
   */
  async record(userId: string, metric: AiMetric, amount = 1): Promise<void> {
    try {
      const context = await this.companyContext.forUser(userId);
      if (!context) return;

      const period = this.periodFor(
        await this.prisma.companySubscription.findUnique({
          where: { companyId: context.companyId },
        }),
      );

      await this.prisma.companyUsage.upsert({
        where: {
          companyId_metric_periodStart: {
            companyId: context.companyId,
            metric,
            periodStart: period.start,
          },
        },
        create: {
          companyId: context.companyId,
          metric,
          periodStart: period.start,
          count: amount,
        },
        update: { count: { increment: amount } },
      });
    } catch (err) {
      this.logger.warn(`Could not record ${metric}: ${(err as Error).message}`);
    }
  }

  /* ------------------------------- helpers -------------------------------- */

  /**
   * The window to count usage against.
   *
   * A paying company's window is Stripe's, so the allowance resets when they
   * are charged. A company with no subscription has no such window, and the
   * calendar month is the only honest substitute — the alternative, counting
   * from signup, would give two identical companies different reset days
   * forever.
   */
  private periodFor(subscription: {
    status: SubscriptionStatus;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
  } | null): UsagePeriod {
    if (subscription?.currentPeriodStart) {
      return {
        start: subscription.currentPeriodStart,
        end: subscription.currentPeriodEnd,
        fromSubscription: true,
      };
    }
    const now = new Date();
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
      fromSubscription: false,
    };
  }
}
