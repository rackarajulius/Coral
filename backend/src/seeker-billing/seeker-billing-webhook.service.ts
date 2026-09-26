import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingInterval, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STATUS_MAP } from '../billing/billing-webhook.service';
import { seekerPriceIds } from './seeker-prices';
import { SeekerPremiumService } from './seeker-premium.service';

/**
 * Turns Stripe's events about job seeker subscriptions into Premium.
 *
 * The same rules as the employer handler, for the same reasons:
 *
 * - **Status is written only from `customer.subscription.*`.** Invoice events
 *   describe the same reality at overlapping times; two writers racing is how
 *   a paying customer gets silently downgraded.
 * - **An unrecognised price grants nothing.** Premium is resolved from the
 *   configured price ids, never from the product's name in the dashboard.
 *
 * And one this handler adds: **an event about a subscription the person no
 * longer has cannot change their Premium.** Stripe does not promise order. If
 * someone cancels and later subscribes again, a delayed "deleted" for the old
 * subscription would otherwise arrive after the new one and switch them off.
 */
@Injectable()
export class SeekerBillingWebhookService {
  private readonly logger = new Logger(SeekerBillingWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly premium: SeekerPremiumService,
  ) {}

  /**
   * Whether an event is about a job seeker rather than a company.
   *
   * Checked before the employer handler. Checkout tags these subscriptions
   * `kind=jobseeker`; a subscription created by hand in the dashboard carries no
   * tag, so the customer id is the fallback. Company customers are never in
   * this table, so nothing of theirs is claimed here.
   */
  async claims(type: string, object: Record<string, unknown>): Promise<boolean> {
    const isSubscription = type.startsWith('customer.subscription.');
    const isInvoice = type === 'invoice.paid' || type === 'invoice.payment_failed';
    if (!isSubscription && !isInvoice) return false;

    const metadata = object.metadata as Record<string, unknown> | undefined;
    if (isSubscription && metadata?.kind === 'jobseeker') return true;

    const customerId = this.str(object.customer);
    if (!customerId) return false;
    const row = await this.prisma.userSubscription.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    return Boolean(row);
  }

  async handle(type: string, object: Record<string, unknown>): Promise<void> {
    if (type.startsWith('customer.subscription.')) {
      await this.applySubscription(object, type === 'customer.subscription.deleted');
      return;
    }
    // Invoices never change Premium: Stripe retries a failed payment itself and
    // moves the subscription to past_due, and that event is what changes it.
    // They only tell the person what happened. Stripe de-duplicates delivery by
    // event id upstream (PaymentsService), so each is sent once.
    if (type === 'invoice.paid') await this.premium.paymentSucceeded(object);
    else if (type === 'invoice.payment_failed') await this.premium.paymentFailed(object);
  }

  private async applySubscription(sub: Record<string, unknown>, deleted: boolean): Promise<void> {
    const userId = await this.resolveUserId(sub);
    if (!userId) {
      this.logger.warn(`Stripe subscription ${String(sub.id)} has no matching job seeker; ignoring.`);
      return;
    }

    const subscriptionId = this.str(sub.id);
    const before = await this.prisma.userSubscription.findUnique({ where: { userId } });

    const status = deleted
      ? SubscriptionStatus.CANCELED
      : (STATUS_MAP[String(sub.status ?? '')] ?? SubscriptionStatus.NONE);
    const live = status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIALING;

    // A stale event for a subscription that has since been replaced.
    if (
      before?.stripeSubscriptionId &&
      subscriptionId &&
      before.stripeSubscriptionId !== subscriptionId &&
      !live
    ) {
      this.logger.log(
        `Ignoring ${status} for replaced subscription ${subscriptionId}; current is ${before.stripeSubscriptionId}.`,
      );
      return;
    }

    const recognised = this.priceRecognised(sub);
    if ((live || status === SubscriptionStatus.PAST_DUE) && !recognised) {
      this.logger.warn(`Subscription ${subscriptionId} has an unrecognised price; granting nothing.`);
    }
    /**
     * Who keeps Premium.
     *
     * - Cancelling keeps it to the period end: Stripe leaves the status `active`
     *   with cancel_at_period_end until then, so no special case is needed.
     * - **A failing card keeps it while Stripe retries.** `past_due` means a
     *   renewal charge failed and Stripe is still trying — over days, sometimes
     *   weeks. Switching someone off on the first decline punishes an expired
     *   card, not a decision to stop paying, and matches the employer rule that
     *   past_due never locks anyone out. If every retry fails, Stripe cancels
     *   the subscription and that event ends Premium.
     */
    const entitled = live || status === SubscriptionStatus.PAST_DUE;
    const stripeEntitled = entitled && recognised;

    const interval = this.intervalOf(sub);
    const data = {
      status,
      stripeEntitled,
      ...(interval ? { interval } : {}),
      ...(sub.currency ? { currency: String(sub.currency).toLowerCase() } : {}),
      stripeCustomerId: this.str(sub.customer),
      stripeSubscriptionId: subscriptionId,
      currentPeriodStart: this.toDate(sub.current_period_start),
      currentPeriodEnd: this.toDate(sub.current_period_end),
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      unitAmount: this.unitAmountOf(sub),
    };

    // One transaction: the flag features read must never disagree with the row
    // that explains it. The tier comes from both sources — what Stripe grants
    // and any admin comp — so a lapsed card can't end a comp.
    const tier = await this.prisma.$transaction(async (tx) => {
      await tx.userSubscription.upsert({
        where: { userId },
        create: { userId, ...data, interval: interval ?? BillingInterval.MONTHLY },
        update: data,
      });
      return this.premium.recomputeTier(userId, tx);
    });

    if (before?.status !== status) {
      this.logger.log(`Job seeker ${userId}: ${before?.status ?? 'NONE'} → ${status} (tier ${tier})`);
    }
  }

  /** Metadata first — it was set at checkout and is exact — then the customer. */
  private async resolveUserId(sub: Record<string, unknown>): Promise<string | null> {
    const metadata = sub.metadata as Record<string, unknown> | undefined;
    const fromMetadata = this.str(metadata?.userId);
    if (fromMetadata) {
      const user = await this.prisma.user.findUnique({
        where: { id: fromMetadata },
        select: { id: true },
      });
      if (user) return user.id;
    }
    const customerId = this.str(sub.customer);
    if (!customerId) return null;
    const row = await this.prisma.userSubscription.findUnique({
      where: { stripeCustomerId: customerId },
      select: { userId: true },
    });
    return row?.userId ?? null;
  }

  private priceRecognised(sub: Record<string, unknown>): boolean {
    const priceId = this.str((this.firstItem(sub)?.price as Record<string, unknown> | undefined)?.id);
    return Boolean(priceId) && seekerPriceIds(this.config).includes(priceId as string);
  }

  private intervalOf(sub: Record<string, unknown>): BillingInterval | null {
    const price = this.firstItem(sub)?.price as Record<string, unknown> | undefined;
    const interval = (price?.recurring as Record<string, unknown> | undefined)?.interval;
    if (interval === 'year') return BillingInterval.YEARLY;
    if (interval === 'month') return BillingInterval.MONTHLY;
    return null;
  }

  private unitAmountOf(sub: Record<string, unknown>): number | null {
    const amount = Number((this.firstItem(sub)?.price as Record<string, unknown> | undefined)?.unit_amount);
    return Number.isFinite(amount) ? amount : null;
  }

  private firstItem(sub: Record<string, unknown>): Record<string, unknown> | null {
    const data = (sub.items as Record<string, unknown> | undefined)?.data as
      | Array<Record<string, unknown>>
      | undefined;
    return data?.[0] ?? null;
  }

  private str(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private toDate(value: unknown): Date | null {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : null;
  }
}
