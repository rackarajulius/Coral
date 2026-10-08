import { StripeClient } from './stripe.client';
import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingInterval,
  CompanyAuditCategory,
  CompanyPlan,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAuditService } from '../company/company-audit.service';
import { PLAN_LABELS } from './plan-entitlements';

/** Stripe's subscription statuses, mapped to the four states we act on. */
export const STATUS_MAP: Record<string, SubscriptionStatus> = {
  trialing: SubscriptionStatus.TRIALING,
  active: SubscriptionStatus.ACTIVE,
  past_due: SubscriptionStatus.PAST_DUE,
  // Stripe distinguishes these three; we do not, because the effect is the
  // same: the plan is not paid for and access falls back to Starter.
  unpaid: SubscriptionStatus.PAST_DUE,
  canceled: SubscriptionStatus.CANCELED,
  incomplete: SubscriptionStatus.NONE,
  incomplete_expired: SubscriptionStatus.CANCELED,
  paused: SubscriptionStatus.CANCELED,
};

/**
 * Turns Stripe's subscription events into the company's plan.
 *
 * Status is written from `customer.subscription.*` and nowhere else. Invoice
 * events describe the same reality and arrive at overlapping times, so letting
 * both write the status field would produce a race whose loser silently
 * downgrades a paying customer. Invoices are recorded in the audit trail only.
 */
@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: CompanyAuditService,
    private readonly stripe: StripeClient,
  ) {}

  /** Whether this service claims the event. Keeps the dispatch table in one place. */
  handles(type: string): boolean {
    return (
      type.startsWith('customer.subscription.') ||
      type === 'invoice.paid' ||
      type === 'invoice.payment_failed'
    );
  }

  async handle(type: string, object: Record<string, unknown>): Promise<void> {
    if (type.startsWith('customer.subscription.')) {
      await this.applySubscription(object);
      return;
    }
    if (type === 'invoice.paid' || type === 'invoice.payment_failed') {
      await this.recordInvoice(object, type === 'invoice.paid');
    }
  }

  /* ------------------------------ subscription ----------------------------- */

  private async applySubscription(
    sub: Record<string, unknown>,
  ): Promise<void> {
    const companyId = await this.resolveCompanyId(sub);
    if (!companyId) {
      // Not an error worth retrying: a subscription for a company we do not
      // have is either test noise or another product on the same Stripe
      // account. Logged so it is visible rather than swallowed.
      this.logger.warn(
        `Stripe subscription ${String(sub.id)} has no matching company; ignoring.`,
      );
      return;
    }

    const change = await this.prisma.$transaction(async (tx) => {
      // Serialize company subscription updates before fetching current provider state.
      // Event timestamps alone cannot order events created in the same second.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${companyId}, 0))::text`;
      const before = await tx.companySubscription.findUnique({ where: { companyId } });
      const subscriptionId = this.str(sub.id);
      if (!subscriptionId) throw new BadGatewayException('Subscription event has no subscription ID');
      sub = await this.stripe.get(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
      if (sub.id !== subscriptionId) throw new BadGatewayException('Billing provider returned a different subscription');
      // Cancellation of a replaced subscription must not cancel its replacement.
      if (before?.stripeSubscriptionId && before.stripeSubscriptionId !== subscriptionId &&
          ['canceled', 'incomplete_expired'].includes(String(sub.status))) return null;

      const stripeStatus = String(sub.status ?? '');
      const status = STATUS_MAP[stripeStatus];
      if (!status) throw new BadGatewayException('Billing provider returned an unknown subscription status');

      /**
       * A cancelled or unpaid subscription falls back to Starter's limits, but
       * nothing is deleted — jobs stay published, members stay in the team. The
       * caps refuse the *next* action instead of undoing past ones.
       */
      const entitledPlan =
        status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIALING
          ? this.planFromSubscription(sub)
          : CompanyPlan.STARTER;

      const interval = this.intervalFromSubscription(sub);
      const unitAmount = this.unitAmountOf(sub);
      const periodStart = this.toDate(sub.current_period_start);
      const periodEnd = this.toDate(sub.current_period_end);

      await tx.companySubscription.upsert({
        where: { companyId },
        create: {
          companyId,
          plan: entitledPlan,
          status,
          interval: interval ?? BillingInterval.MONTHLY,
          currency: String(sub.currency ?? this.defaultCurrency()).toLowerCase(),
          stripeCustomerId: this.str(sub.customer),
          stripeSubscriptionId: this.str(sub.id),
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          unitAmount,
        },
        update: {
          plan: entitledPlan,
          status,
          ...(interval ? { interval } : {}),
          ...(sub.currency ? { currency: String(sub.currency).toLowerCase() } : {}),
          stripeSubscriptionId: this.str(sub.id),
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          unitAmount,
        },
      });

      return { before, after: { plan: entitledPlan, status } };
    }, { timeout: 20_000 });
    if (change) await this.auditPlanChange(companyId, change.before, change.after);
  }

  /**
   * Which plan a price corresponds to.
   *
   * Resolved from the configured price ids rather than from Stripe's product
   * name, which is editable in the dashboard by anyone with access — a rename
   * there should not be able to grant a plan here.
   */
  private planFromSubscription(sub: Record<string, unknown>): CompanyPlan {
    const priceId = this.priceIdOf(sub);
    if (!priceId) return CompanyPlan.STARTER;

    const configured: Array<[CompanyPlan, string[]]> = [
      [
        CompanyPlan.PRO,
        ['STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PRO_YEARLY'].map((k) =>
          this.config.get<string>(k, '').trim(),
        ),
      ],
      [
        CompanyPlan.ENTERPRISE,
        ['STRIPE_PRICE_ENTERPRISE_MONTHLY', 'STRIPE_PRICE_ENTERPRISE_YEARLY'].map((k) =>
          this.config.get<string>(k, '').trim(),
        ),
      ],
    ];

    for (const [plan, ids] of configured) {
      if (ids.filter(Boolean).includes(priceId)) return plan;
    }

    // An unrecognised price is not a licence to guess upward. Starter is the
    // safe default: it withholds features rather than handing them out.
    this.logger.warn(`Unrecognised Stripe price ${priceId}; treating as Starter.`);
    return CompanyPlan.STARTER;
  }

  private intervalFromSubscription(sub: Record<string, unknown>): BillingInterval | null {
    const item = this.firstItem(sub);
    const recurring = (item?.price as Record<string, unknown> | undefined)?.recurring as
      | Record<string, unknown>
      | undefined;
    const interval = recurring?.interval;
    if (interval === 'year') return BillingInterval.YEARLY;
    if (interval === 'month') return BillingInterval.MONTHLY;
    return null;
  }

  /** What Stripe charges per period, in cents. Null when there is no price. */
  private unitAmountOf(sub: Record<string, unknown>): number | null {
    const item = this.firstItem(sub);
    const price = item?.price as Record<string, unknown> | undefined;
    if (price?.unit_amount == null) return null;
    const amount = Number(price.unit_amount);
    return Number.isFinite(amount) ? amount : null;
  }

  private priceIdOf(sub: Record<string, unknown>): string | null {
    const item = this.firstItem(sub);
    const price = item?.price as Record<string, unknown> | undefined;
    return this.str(price?.id);
  }

  private firstItem(sub: Record<string, unknown>): Record<string, unknown> | null {
    const items = sub.items as Record<string, unknown> | undefined;
    const data = items?.data as Array<Record<string, unknown>> | undefined;
    return data?.[0] ?? null;
  }

  /* -------------------------------- invoices ------------------------------- */

  /**
   * Invoices are logged, not acted on.
   *
   * A failed payment does not switch anything off here. Stripe retries on its
   * own schedule and moves the subscription to `past_due`, which is what
   * actually changes the plan — cutting a recruiter off mid-hire the moment a
   * card expires would be both hostile and premature.
   */
  private async recordInvoice(invoice: Record<string, unknown>, paid: boolean): Promise<void> {
    const companyId = await this.companyIdForCustomer(this.str(invoice.customer));
    if (!companyId) return;

    const amount = Number(invoice.amount_due ?? invoice.amount_paid ?? 0);
    const currency = String(invoice.currency ?? 'cad').toUpperCase();
    const formatted = `${(amount / 100).toFixed(2)} ${currency}`;

    await this.audit.record({
      companyId,
      actor: { id: null, name: 'Stripe' },
      category: CompanyAuditCategory.COMPANY,
      action: paid ? 'Payment received' : 'Payment failed',
      entityType: 'invoice',
      entityId: this.str(invoice.id) ?? undefined,
      summary: paid
        ? `Invoice of ${formatted} was paid.`
        : `Invoice of ${formatted} could not be charged. Stripe will retry automatically.`,
    });
  }

  /* ------------------------------- resolution ------------------------------ */

  /**
   * Finds the company behind a Stripe subscription.
   *
   * Metadata first because it was set at checkout and is exact. The stored
   * customer id is the fallback for subscriptions created in the Stripe
   * dashboard, which carry no metadata of ours.
   */
  private async resolveCompanyId(sub: Record<string, unknown>): Promise<string | null> {
    const metadata = sub.metadata as Record<string, unknown> | undefined;
    const fromMetadata = this.str(metadata?.companyId);
    if (fromMetadata) {
      const exists = await this.prisma.company.findUnique({
        where: { id: fromMetadata },
        select: { id: true },
      });
      if (exists) return exists.id;
    }
    return this.companyIdForCustomer(this.str(sub.customer));
  }

  private async companyIdForCustomer(customerId: string | null): Promise<string | null> {
    if (!customerId) return null;
    const row = await this.prisma.companySubscription.findUnique({
      where: { stripeCustomerId: customerId },
      select: { companyId: true },
    });
    return row?.companyId ?? null;
  }

  private async auditPlanChange(
    companyId: string,
    before: { plan: CompanyPlan; status: SubscriptionStatus } | null,
    after: { plan: CompanyPlan; status: SubscriptionStatus },
  ): Promise<void> {
    // Stripe resends events and sends updates for changes we do not track
    // (a new card, a changed address). Only a real move is worth a line.
    if (before && before.plan === after.plan && before.status === after.status) return;

    await this.audit.record({
      companyId,
      actor: { id: null, name: 'Stripe' },
      category: CompanyAuditCategory.COMPANY,
      action: 'Plan changed',
      entityType: 'subscription',
      summary: before
        ? `Plan moved from ${PLAN_LABELS[before.plan].name} (${before.status}) to ${PLAN_LABELS[after.plan].name} (${after.status}).`
        : `Subscribed to ${PLAN_LABELS[after.plan].name} (${after.status}).`,
      before: before ? { plan: before.plan, status: before.status } : undefined,
      after: { plan: after.plan, status: after.status },
    });
  }

  /* --------------------------------- utils -------------------------------- */

  private str(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  /** Stripe sends seconds; Date wants milliseconds. */
  private toDate(value: unknown): Date | null {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : null;
  }

  private defaultCurrency(): string {
    return this.config.get<string>('BILLING_DEFAULT_CURRENCY', 'cad').trim().toLowerCase();
  }
}
