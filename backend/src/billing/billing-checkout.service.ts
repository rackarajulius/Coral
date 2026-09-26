import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingInterval, CompanyPlan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { User } from '../common/types/user.types';
import { StripeClient } from './stripe.client';

/**
 * Plans that can be bought without talking to anyone.
 *
 * STARTER is free, so there is nothing to check out. ENTERPRISE is negotiated,
 * and offering a self-serve button for it would take money for terms nobody
 * agreed to.
 */
const SELF_SERVE_PLANS = [CompanyPlan.PRO] as const;
type SelfServePlan = (typeof SELF_SERVE_PLANS)[number];

/** Env var holding the Stripe price id for each purchasable plan and interval. */
const PRICE_ENV: Record<SelfServePlan, Record<BillingInterval, string>> = {
  [CompanyPlan.PRO]: {
    [BillingInterval.MONTHLY]: 'STRIPE_PRICE_PRO_MONTHLY',
    [BillingInterval.YEARLY]: 'STRIPE_PRICE_PRO_YEARLY',
  },
};

/**
 * Starting a subscription and reaching the billing portal.
 *
 * Card details never touch this server. Checkout and the portal are both
 * Stripe-hosted, which keeps the whole application out of PCI scope — the
 * reason the in-app card form that used to live on the billing page was
 * removed rather than wired up.
 */
@Injectable()
export class BillingCheckoutService {
  private readonly logger = new Logger(BillingCheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly stripe: StripeClient,
    private readonly companyContext: CompanyContextService,
  ) {}

  /**
   * A Stripe Checkout session for upgrading.
   *
   * Returns a URL for the caller to follow. Nothing is charged here and no
   * local state changes — the subscription only becomes real when Stripe says
   * so over the webhook. Writing it optimistically would hand out a paid plan
   * to anyone who opened the checkout page and closed it.
   */
  async createCheckoutSession(
    user: User,
    input: { plan: CompanyPlan; interval: BillingInterval; successUrl: string; cancelUrl: string },
  ): Promise<{ url: string }> {
    const context = await this.companyContext.requireForUser(user.id);

    if (!SELF_SERVE_PLANS.includes(input.plan as SelfServePlan)) {
      throw new BadRequestException(
        input.plan === CompanyPlan.ENTERPRISE
          ? 'Enterprise plans are arranged with our team rather than bought online.'
          : 'That plan is free — there is nothing to pay for.',
      );
    }

    const priceId = this.priceIdFor(input.plan as SelfServePlan, input.interval);
    const customerId = await this.ensureCustomer(context.companyId, context.companyName, user);

    const session = await this.stripe.post<{ url?: string; id: string }>('/checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': 1,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      /**
       * The company id has to survive the round trip: the webhook arrives with
       * a Stripe customer, and matching back by email would attach the
       * subscription to the wrong company the first time two teams share a
       * billing contact.
       */
      'metadata[companyId]': context.companyId,
      'subscription_data[metadata][companyId]': context.companyId,
      // So Stripe collects the tax id and address rather than us storing them.
      tax_id_collection: 'enabled',
      'automatic_tax[enabled]': 'true',
      billing_address_collection: 'required',
    });

    if (!session.url) {
      throw new ServiceUnavailableException('Stripe did not return a checkout URL.');
    }
    return { url: session.url };
  }

  /**
   * A link into Stripe's hosted billing portal.
   *
   * Cards, invoices, receipts, tax ids and cancellation all live there. A
   * company that has never subscribed has no Stripe customer and therefore no
   * portal — that is reported plainly rather than by creating an empty one.
   */
  async createPortalSession(user: User, returnUrl: string): Promise<{ url: string }> {
    const context = await this.companyContext.requireForUser(user.id);
    const subscription = await this.prisma.companySubscription.findUnique({
      where: { companyId: context.companyId },
      select: { stripeCustomerId: true },
    });

    if (!subscription?.stripeCustomerId) {
      throw new BadRequestException(
        'There is no billing account yet. Start a subscription first.',
      );
    }

    const session = await this.stripe.post<{ url?: string }>('/billing_portal/sessions', {
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
    });

    if (!session.url) {
      throw new ServiceUnavailableException('Stripe did not return a portal URL.');
    }
    return { url: session.url };
  }

  /**
   * The company's invoices, read live from Stripe.
   *
   * Not mirrored into our database: Stripe is the record of what was charged,
   * and a local copy would be a second version of financial history that can
   * drift from the real one. Refunds and credit notes applied in the Stripe
   * dashboard show up here immediately for the same reason.
   */
  async listInvoices(user: User, limit = 12) {
    const context = await this.companyContext.requireForUser(user.id);
    const subscription = await this.prisma.companySubscription.findUnique({
      where: { companyId: context.companyId },
      select: { stripeCustomerId: true },
    });

    // No customer means no invoices — an empty list, not an error.
    if (!subscription?.stripeCustomerId) return { invoices: [] };

    const capped = Math.min(Math.max(limit, 1), 100);
    const result = await this.stripe.get<{ data: Array<Record<string, unknown>> }>(
      `/invoices?customer=${encodeURIComponent(subscription.stripeCustomerId)}&limit=${capped}`,
    );

    return {
      invoices: (result.data ?? []).map((inv) => ({
        id: String(inv.id ?? ''),
        /** Stripe's human-facing number, e.g. "A1B2C3-0001". Absent on drafts. */
        number: (inv.number as string | null) ?? null,
        createdAt: new Date(Number(inv.created ?? 0) * 1000).toISOString(),
        /** In the currency's smallest unit, as Stripe reports it. */
        amountPaid: Number(inv.amount_paid ?? 0),
        amountDue: Number(inv.amount_due ?? 0),
        currency: String(inv.currency ?? 'cad').toLowerCase(),
        status: String(inv.status ?? 'draft'),
        /**
         * Stripe-hosted links. We never render or store a PDF of our own —
         * generating a second document for the same charge is how two
         * disagreeing receipts end up in someone's accounts.
         */
        hostedUrl: (inv.hosted_invoice_url as string | null) ?? null,
        pdfUrl: (inv.invoice_pdf as string | null) ?? null,
      })),
    };
  }

  /* ------------------------------- helpers -------------------------------- */

  /**
   * The company's Stripe customer, created once.
   *
   * The unique constraint on `stripeCustomerId` is the real guard: two owners
   * clicking upgrade at the same moment would otherwise create two customers
   * and split the company's billing history in half.
   */
  private async ensureCustomer(
    companyId: string,
    companyName: string,
    user: User,
  ): Promise<string> {
    const existing = await this.prisma.companySubscription.findUnique({
      where: { companyId },
      select: { stripeCustomerId: true },
    });
    if (existing?.stripeCustomerId) return existing.stripeCustomerId;

    const customer = await this.stripe.post<{ id: string }>('/customers', {
      name: companyName,
      email: user.email,
      'metadata[companyId]': companyId,
    });

    try {
      await this.prisma.companySubscription.upsert({
        where: { companyId },
        create: {
          companyId,
          stripeCustomerId: customer.id,
          currency: this.defaultCurrency(),
        },
        update: { stripeCustomerId: customer.id },
      });
      return customer.id;
    } catch (err) {
      // Lost the race: another request stored a customer between our read and
      // our write. Theirs is as good as ours, so use it and abandon the
      // duplicate rather than failing the upgrade.
      const winner = await this.prisma.companySubscription.findUnique({
        where: { companyId },
        select: { stripeCustomerId: true },
      });
      if (winner?.stripeCustomerId) {
        this.logger.warn(
          `Discarding duplicate Stripe customer ${customer.id} for company ${companyId}`,
        );
        return winner.stripeCustomerId;
      }
      throw err;
    }
  }

  private priceIdFor(plan: SelfServePlan, interval: BillingInterval): string {
    const envKey = PRICE_ENV[plan][interval];
    const priceId = this.config.get<string>(envKey, '').trim();
    if (!priceId) {
      throw new ServiceUnavailableException(
        `Billing is not configured for this plan yet. Set ${envKey} in backend/.env`,
      );
    }
    return priceId;
  }

  /** Canada-first. Stripe fixes this at the first payment and it cannot change. */
  private defaultCurrency(): string {
    return this.config.get<string>('BILLING_DEFAULT_CURRENCY', 'cad').trim().toLowerCase();
  }
}
