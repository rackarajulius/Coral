import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyPlan } from '@prisma/client';
import { StripeClient } from './stripe.client';
import { PRICE_ENV, SELF_SERVE_PLANS, type SelfServePlan } from './plan-entitlements';

/**
 * What a plan costs, as one of the four things that can actually be true.
 *
 * A discriminated union rather than `amount: number | null`, because "free",
 * "negotiated", and "we could not read the price" are three different facts and
 * every one of them renders as `null`. Collapsing them is how a plan whose
 * price id is missing from the environment ends up advertised as $0.
 */
export type PlanPrice =
  | { kind: 'free' }
  /** Negotiated. There is no list price to quote. */
  | { kind: 'custom' }
  | {
      kind: 'listed';
      /** Lower-case ISO code, as Stripe reports it. */
      currency: string;
      /** Charged per month, in the currency's smallest unit. */
      monthly: number | null;
      /** Charged per year, in the currency's smallest unit — not per month. */
      yearly: number | null;
    }
  /** Purchasable in principle, but we cannot say for how much right now. */
  | { kind: 'unavailable'; reason: string };

interface StripePrice {
  unit_amount: number | null;
  currency: string;
  active: boolean;
  recurring?: { interval?: string } | null;
}

/** Prices change rarely and a plan grid is read constantly. */
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * List prices, read from the same Stripe price ids checkout charges against.
 *
 * The point is that there is one source of truth. Before this, the billing page
 * showed no price at all and the marketing page quoted a hard-coded number that
 * nothing reconciled against Stripe — so the figure a company agreed to and the
 * figure it was charged had no relationship.
 */
@Injectable()
export class PlanPricingService {
  private readonly logger = new Logger(PlanPricingService.name);
  private cache: { at: number; value: Record<CompanyPlan, PlanPrice> } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly stripe: StripeClient,
  ) {}

  /** Every plan's price. Never throws — a plan grid must render regardless. */
  async all(): Promise<Record<CompanyPlan, PlanPrice>> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.value;

    const value = {
      [CompanyPlan.STARTER]: { kind: 'free' } as PlanPrice,
      [CompanyPlan.ENTERPRISE]: { kind: 'custom' } as PlanPrice,
    } as Record<CompanyPlan, PlanPrice>;

    for (const plan of SELF_SERVE_PLANS) {
      value[plan] = await this.forSelfServe(plan);
    }

    this.cache = { at: Date.now(), value };
    return value;
  }

  /** Drops the cache, so a price change in Stripe can be picked up deliberately. */
  forget(): void {
    this.cache = null;
  }

  private async forSelfServe(plan: SelfServePlan): Promise<PlanPrice> {
    if (!this.stripe.configured) {
      return { kind: 'unavailable', reason: 'Billing is not connected yet.' };
    }

    const [monthly, yearly] = await Promise.all([
      this.readPrice(plan, 'MONTHLY'),
      this.readPrice(plan, 'YEARLY'),
    ]);

    // Neither interval readable means we know nothing, and saying so beats
    // quoting half a price list as though it were the whole one.
    if (monthly === null && yearly === null) {
      return { kind: 'unavailable', reason: 'This plan has no price set up yet.' };
    }

    return {
      kind: 'listed',
      currency: monthly?.currency ?? yearly?.currency ?? this.defaultCurrency(),
      monthly: monthly?.amount ?? null,
      yearly: yearly?.amount ?? null,
    };
  }

  private async readPrice(
    plan: SelfServePlan,
    interval: 'MONTHLY' | 'YEARLY',
  ): Promise<{ amount: number; currency: string } | null> {
    const priceId = this.config.get<string>(PRICE_ENV[plan][interval], '').trim();
    if (!priceId) return null;

    try {
      const price = await this.stripe.get<StripePrice>(`/prices/${encodeURIComponent(priceId)}`);

      if (price.unit_amount === null || price.unit_amount === undefined) {
        // Tiered or metered pricing has no single amount to print.
        return null;
      }
      if (price.active === false) {
        this.logger.warn(`Stripe price ${priceId} (${plan} ${interval}) is archived.`);
        return null;
      }

      /**
       * A monthly price id pasted into the yearly slot would otherwise be
       * quoted as a year's cost — someone would agree to $49 a year and be
       * charged $49 a month. Refuse to quote a price whose real recurrence
       * disagrees with the slot it was configured in.
       */
      const expected = interval === 'MONTHLY' ? 'month' : 'year';
      const actual = price.recurring?.interval;
      if (actual && actual !== expected) {
        this.logger.error(
          `Stripe price ${priceId} is configured as ${PRICE_ENV[plan][interval]} but recurs every ${actual}. Not quoting it.`,
        );
        return null;
      }

      return { amount: price.unit_amount, currency: (price.currency || '').toLowerCase() };
    } catch (err) {
      // A pricing lookup must never take down the billing page.
      this.logger.warn(
        `Could not read Stripe price for ${plan} ${interval}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private defaultCurrency(): string {
    return this.config.get<string>('BILLING_DEFAULT_CURRENCY', 'cad').trim().toLowerCase();
  }
}
