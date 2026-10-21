import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingInterval, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';
import { StripeClient } from '../billing/stripe.client';
import {
  SEEKER_METRICS,
  SEEKER_METRIC_KEYS,
  SeekerMetric,
} from '../seeker-entitlements/seeker-entitlements';
import { seekerPriceId } from './seeker-prices';

export interface PremiumPrice {
  interval: BillingInterval;
  /** In the currency's smallest unit, exactly as Stripe charges it. */
  unitAmount: number;
  currency: string;
}

/** Statuses that mean a subscription is still live, so a second one is refused. */
const LIVE = new Set<SubscriptionStatus>([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
]);

const PRICE_CACHE_MS = 10 * 60 * 1000;

/**
 * Job seeker Premium: its state, its real prices, and the two doors into Stripe.
 *
 * Mirrors the employer checkout's shape — Stripe-hosted checkout and portal, so
 * card details never reach this server, and nothing is granted at checkout
 * time; the webhook grants Premium once Stripe confirms payment. It is a
 * separate product billed to a different party, so it has its own Stripe
 * customers, its own prices and its own table.
 */
@Injectable()
export class SeekerBillingService {
  private readonly logger = new Logger(SeekerBillingService.name);
  private priceCache: { at: number; prices: PremiumPrice[] } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly stripe: StripeClient,
  ) {}

  /** The caller's own subscription, as far as it exists. */
  async subscription(user: User) {
    const row = await this.prisma.userSubscription.findUnique({ where: { userId: user.id } });
    return {
      tier: user.subscriptionTier === 'premium' ? ('premium' as const) : ('free' as const),
      status: row?.status ?? SubscriptionStatus.NONE,
      interval: row?.interval ?? null,
      currentPeriodEnd: row?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
      unitAmount: row?.unitAmount ?? null,
      currency: row?.currency ?? null,
      /** Whether there is a Stripe customer to open the portal for. */
      hasBillingAccount: Boolean(row?.stripeCustomerId),
      /** Whether a paid subscription is what grants Premium right now. */
      paid: Boolean(row?.stripeEntitled),
      /** Complimentary Premium until this date, when one is running. */
      compedUntil:
        row?.compedUntil && row.compedUntil.getTime() > Date.now()
          ? row.compedUntil.toISOString()
          : null,
    };
  }

  /**
   * What Premium costs and what it includes.
   *
   * Prices are read from Stripe, never typed into the page: the number shown is
   * the number charged. Before the prices are set up, `available` is false and
   * the page says Premium isn't on sale yet rather than inventing a figure.
   * The tier table comes from the same registry that meters usage, so the page
   * can't promise a limit the server doesn't apply.
   */
  async plans() {
    const live = this.liveFeatures();
    const tiers = SEEKER_METRIC_KEYS.map((metric) => ({
      metric,
      label: SEEKER_METRICS[metric].label,
      window: SEEKER_METRICS[metric].window,
      free: SEEKER_METRICS[metric].limits.free,
      premium: SEEKER_METRICS[metric].limits.premium,
      /**
       * Whether it actually works right now. A feature whose provider isn't
       * configured is shown as coming soon rather than sold — someone paying
       * for company research would otherwise get "not set up".
       */
      live: live[metric],
    }));

    const prices = await this.livePrices();
    return { available: prices.length > 0, prices, tiers };
  }

  /**
   * A Stripe Checkout session. Returns a URL to follow; changes nothing here.
   *
   * Premium only starts when the webhook says Stripe was paid — granting it now
   * would hand it to anyone who opened checkout and closed the tab.
   */
  async checkout(user: User, interval: BillingInterval, returnPath: string) {
    const priceId = seekerPriceId(this.config, interval);
    if (!priceId) {
      throw new ServiceUnavailableException(
        'Premium is not on sale yet. Its prices have not been set up.',
      );
    }

    const existing = await this.prisma.userSubscription.findUnique({ where: { userId: user.id } });
    if (existing?.stripeSubscriptionId && LIVE.has(existing.status)) {
      // A second subscription would bill twice for one Premium.
      throw new BadRequestException(
        'You already have Premium. Change or cancel it from Manage billing.',
      );
    }

    const customerId = await this.ensureCustomer(user);
    const session = await this.stripe.post<{ url?: string }>('/checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': 1,
      success_url: this.frontendUrl(this.withParam(returnPath, 'checkout=success')),
      cancel_url: this.frontendUrl(this.withParam(returnPath, 'checkout=cancelled')),
      /**
       * Marks the subscription as a job seeker's, so the webhook routes it here
       * and never to the employer handler — and carries whose it is, since the
       * customer alone is not enough the first time the event arrives.
       */
      'metadata[kind]': 'jobseeker',
      'metadata[userId]': user.id,
      'subscription_data[metadata][kind]': 'jobseeker',
      'subscription_data[metadata][userId]': user.id,
      'automatic_tax[enabled]': 'true',
      billing_address_collection: 'required',
    });

    if (!session.url) {
      throw new ServiceUnavailableException('Stripe did not return a checkout URL.');
    }
    return { url: session.url };
  }

  /** Stripe's hosted portal: card, receipts, switching interval, cancelling. */
  async portal(user: User, returnPath: string) {
    const row = await this.prisma.userSubscription.findUnique({
      where: { userId: user.id },
      select: { stripeCustomerId: true },
    });
    if (!row?.stripeCustomerId) {
      throw new BadRequestException('There is no billing account yet. Start Premium first.');
    }
    const session = await this.stripe.post<{ url?: string }>('/billing_portal/sessions', {
      customer: row.stripeCustomerId,
      return_url: this.frontendUrl(returnPath),
    });
    if (!session.url) {
      throw new ServiceUnavailableException('Stripe did not return a portal URL.');
    }
    return { url: session.url };
  }

  /* ------------------------------- helpers -------------------------------- */

  /**
   * Which Premium features have what they need to run.
   *
   * Mirrors each provider's own `isEnabled()` in the resume-matcher module
   * (those providers aren't exported). If a source's switch changes there,
   * change it here too.
   */
  private liveFeatures(): Record<SeekerMetric, boolean> {
    const has = (key: string) => Boolean(this.config.get<string>(key, '').trim());
    const webSource =
      (has('ADZUNA_APP_ID') && has('ADZUNA_APP_KEY')) ||
      has('RAPID_API_KEY') ||
      has('GREENHOUSE_BOARDS') ||
      has('LEVER_COMPANIES') ||
      has('ASHBY_BOARDS');
    return {
      'coach.session': true,
      'matcher.web': webSource,
      'assist.cover_letter': true,
      'assist.tailor': true,
      'research.company': has('FIRECRAWL_API_KEY'),
    };
  }

  private async livePrices(): Promise<PremiumPrice[]> {
    if (this.priceCache && Date.now() - this.priceCache.at < PRICE_CACHE_MS) {
      return this.priceCache.prices;
    }
    if (!this.stripe.configured) return [];

    const prices: PremiumPrice[] = [];
    for (const interval of Object.values(BillingInterval) as BillingInterval[]) {
      const id = seekerPriceId(this.config, interval);
      if (!id) continue;
      try {
        const price = await this.stripe.get<Record<string, unknown>>(
          `/prices/${encodeURIComponent(id)}`,
        );
        const unitAmount = Number(price.unit_amount);
        if (price.active === false || !Number.isFinite(unitAmount)) continue;
        prices.push({
          interval,
          unitAmount,
          currency: String(price.currency ?? 'cad').toLowerCase(),
        });
      } catch (error) {
        // A misconfigured id is not shown as a price. Logged so it gets fixed.
        this.logger.warn(
          `Could not read Premium price ${id}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }

    this.priceCache = { at: Date.now(), prices };
    return prices;
  }

  /**
   * One Stripe customer per person, created once.
   *
   * The unique index on the customer id is the real guard: two tabs pressing
   * upgrade together would otherwise split someone's billing across two
   * customers. The loser adopts the winner's.
   */
  private async ensureCustomer(user: User): Promise<string> {
    const existing = await this.prisma.userSubscription.findUnique({
      where: { userId: user.id },
      select: { stripeCustomerId: true },
    });
    if (existing?.stripeCustomerId) return existing.stripeCustomerId;

    const customer = await this.stripe.post<{ id: string }>('/customers', {
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
      'metadata[kind]': 'jobseeker',
      'metadata[userId]': user.id,
    });

    try {
      await this.prisma.userSubscription.upsert({
        where: { userId: user.id },
        create: { userId: user.id, stripeCustomerId: customer.id, currency: this.currency() },
        update: { stripeCustomerId: customer.id },
      });
      return customer.id;
    } catch (error) {
      const winner = await this.prisma.userSubscription.findUnique({
        where: { userId: user.id },
        select: { stripeCustomerId: true },
      });
      if (winner?.stripeCustomerId) {
        this.logger.warn(`Discarding duplicate Stripe customer ${customer.id} for user ${user.id}`);
        return winner.stripeCustomerId;
      }
      throw error;
    }
  }

  private frontendUrl(path: string): string {
    const base = this.config.get<string>('FRONTEND_URL', 'http://localhost:8081').replace(/\/+$/, '');
    return `${base}${path}`;
  }

  private withParam(path: string, param: string): string {
    const [beforeHash, hash] = path.split('#');
    const joined = `${beforeHash}${beforeHash.includes('?') ? '&' : '?'}${param}`;
    return hash !== undefined ? `${joined}#${hash}` : joined;
  }

  private currency(): string {
    return this.config.get<string>('BILLING_DEFAULT_CURRENCY', 'cad').trim().toLowerCase();
  }
}
