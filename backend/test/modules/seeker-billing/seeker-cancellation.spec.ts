import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { StripeClient } from '../../../src/billing/stripe.client';
import { SeekerBillingService } from '../../../src/seeker-billing/seeker-billing.service';
import { SeekerBillingWebhookService } from '../../../src/seeker-billing/seeker-billing-webhook.service';
import { SeekerPremiumService } from '../../../src/seeker-billing/seeker-premium.service';
import { User } from '../../../src/common/types/user.types';

/**
 * Ending Premium: cancelling from the app, changing one's mind, and Stripe
 * giving up on a payment.
 */

const env: Record<string, string> = {
  STRIPE_SECRET_KEY: 'sk_test_fixture',
  STRIPE_PRICE_SEEKER_MONTHLY: 'price_monthly',
  STRIPE_PRICE_SEEKER_YEARLY: 'price_yearly',
  FRONTEND_URL: 'http://localhost:8081',
};
const config = { get: (key: string, fallback?: string) => env[key] ?? fallback } as unknown as ConfigService;

/** A Stripe subscription as the webhook receives it. */
function stripeSub(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'sub_current',
    customer: 'cus_candidate',
    status,
    metadata: { kind: 'jobseeker', userId: 'candidate' },
    items: { data: [{ price: { id: 'price_monthly', unit_amount: 1000, recurring: { interval: 'month' } } }] },
    current_period_start: 1_790_000_000,
    current_period_end: 1_792_600_000,
    cancel_at_period_end: false,
    ...extra,
  };
}

describe('What Stripe says about a subscription, and who keeps Premium', () => {
  function harness(opts: { tierBefore?: 'free' | 'premium'; comped?: boolean } = {}) {
    let written: Record<string, unknown> = {};
    const tx = {
      userSubscription: {
        upsert: jest.fn().mockImplementation(async ({ update }) => {
          written = update;
        }),
      },
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockImplementation(async ({ select }) =>
          select?.subscriptionTier ? { subscriptionTier: opts.tierBefore ?? 'premium' } : { id: 'candidate' }),
      },
      userSubscription: { findUnique: jest.fn().mockResolvedValue({ stripeSubscriptionId: 'sub_current', status: 'ACTIVE' }) },
      $transaction: jest.fn().mockImplementation(async (fn) => fn(tx)),
    };
    const premium = {
      // Premium is "Stripe entitled OR a comp running", as recomputeTier works it out.
      recomputeTier: jest.fn().mockImplementation(async () => (written.stripeEntitled || opts.comped ? 'premium' : 'free')),
      paidPremiumEnded: jest.fn(),
    };
    const service = new SeekerBillingWebhookService(
      prisma as unknown as PrismaService,
      config,
      premium as unknown as SeekerPremiumService,
    );
    return { service, premium, written: () => written };
  }

  it('keeps Premium while Stripe is still retrying a failed payment', async () => {
    const { service, premium, written } = harness();
    await expect(service.handle('customer.subscription.updated', stripeSub('past_due'))).resolves.toBeUndefined();
    expect(written()).toEqual(expect.objectContaining({ status: SubscriptionStatus.PAST_DUE, stripeEntitled: true }));
    expect(premium.paidPremiumEnded).not.toHaveBeenCalled();
  });

  it('ends it once Stripe has stopped collecting (unpaid), and says why', async () => {
    const { service, premium, written } = harness();
    await service.handle('customer.subscription.updated', stripeSub('unpaid'));
    expect(written()).toEqual(expect.objectContaining({ stripeEntitled: false }));
    expect(premium.paidPremiumEnded).toHaveBeenCalledWith('candidate', 'unpaid');
  });

  it('tells the person when a cancelled Premium runs out', async () => {
    const { service, premium } = harness();
    await service.handle('customer.subscription.deleted', stripeSub('canceled'));
    expect(premium.paidPremiumEnded).toHaveBeenCalledWith('candidate', 'ended');
  });

  it('says nothing when a comp keeps Premium on, or when the same news comes twice', async () => {
    const comped = harness({ comped: true });
    await comped.service.handle('customer.subscription.deleted', stripeSub('canceled'));
    expect(comped.premium.paidPremiumEnded).not.toHaveBeenCalled();

    const repeat = harness({ tierBefore: 'free' });
    await repeat.service.handle('customer.subscription.deleted', stripeSub('canceled'));
    expect(repeat.premium.paidPremiumEnded).not.toHaveBeenCalled();
  });

  it('keeps Premium to the end of the period after a cancellation', async () => {
    const { service, premium, written } = harness();
    await service.apply(stripeSub('active', { cancel_at_period_end: true }));
    expect(written()).toEqual(expect.objectContaining({ stripeEntitled: true, cancelAtPeriodEnd: true }));
    expect(premium.paidPremiumEnded).not.toHaveBeenCalled();
  });
});

describe('Cancelling Premium in the app', () => {
  const user = { id: 'candidate', email: 'dev.candidate@coral.test', role: 'JOB_SEEKER', subscriptionTier: 'premium' } as User;

  function harness(row: Record<string, unknown> | null) {
    const prisma = { userSubscription: { findUnique: jest.fn().mockResolvedValue(row) } };
    const stripe = new StripeClient(config);
    const post = jest.fn().mockImplementation(async (_path: string, form: Record<string, string>) =>
      stripeSub('active', { cancel_at_period_end: form.cancel_at_period_end === 'true' }));
    const del = jest.fn().mockResolvedValue(stripeSub('canceled'));
    stripe.post = post as unknown as StripeClient['post'];
    stripe.delete = del as unknown as StripeClient['delete'];
    const subscriptions = { apply: jest.fn().mockResolvedValue('premium') };
    const service = new SeekerBillingService(
      prisma as unknown as PrismaService,
      config,
      stripe,
      subscriptions as unknown as SeekerBillingWebhookService,
    );
    return { service, post, del, subscriptions };
  }
  const paying = {
    stripeSubscriptionId: 'sub_current',
    status: SubscriptionStatus.ACTIVE,
    stripeEntitled: true,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
  };

  it('asks Stripe to end it when the paid period runs out, with the reason given', async () => {
    const { service, post, subscriptions } = harness(paying);
    await service.cancel(user, { reason: 'too_expensive', comment: '  Back in spring  ' });
    expect(post).toHaveBeenCalledWith('/subscriptions/sub_current', {
      cancel_at_period_end: 'true',
      'cancellation_details[feedback]': 'too_expensive',
      'cancellation_details[comment]': 'Back in spring',
    });
    // The page is right at once, by the same rules the webhook uses.
    expect(subscriptions.apply).toHaveBeenCalledWith(expect.objectContaining({ cancel_at_period_end: true }));
  });

  it('does nothing the second time', async () => {
    const { service, post } = harness({ ...paying, cancelAtPeriodEnd: true });
    await service.cancel(user, {});
    expect(post).not.toHaveBeenCalled();
  });

  it('ends an unpaid subscription now: it has no paid period left', async () => {
    const { service, post, del } = harness({ ...paying, status: SubscriptionStatus.PAST_DUE, stripeEntitled: false });
    await service.cancel(user, {});
    expect(del).toHaveBeenCalledWith('/subscriptions/sub_current');
    expect(post).not.toHaveBeenCalled();
  });

  it('refuses when there is nothing to cancel', async () => {
    await expect(harness(null).service.cancel(user, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(harness({ ...paying, status: SubscriptionStatus.CANCELED }).service.cancel(user, {}))
      .rejects.toThrow('no Premium subscription');
  });

  it('Keep Premium undoes a cancellation before it takes effect', async () => {
    const { service, post } = harness({ ...paying, cancelAtPeriodEnd: true });
    await service.keep(user);
    expect(post).toHaveBeenCalledWith('/subscriptions/sub_current', { cancel_at_period_end: 'false' });
  });

  it('Keep Premium is refused when nothing is ending, or it already has', async () => {
    await expect(harness(paying).service.keep(user)).rejects.toThrow('not set to end');
    await expect(harness({ ...paying, cancelAtPeriodEnd: true, currentPeriodEnd: new Date(Date.now() - 1000) }).service.keep(user))
      .rejects.toThrow('already ended');
  });
});

describe('Checking with Stripe on the way back from checkout', () => {
  const user = { id: 'candidate', email: 'dev.candidate@coral.test', role: 'JOB_SEEKER', subscriptionTier: 'free' } as User;

  function harness(row: Record<string, unknown> | null, subscriptions: Array<Record<string, unknown>>) {
    const prisma = { userSubscription: { findUnique: jest.fn().mockResolvedValue(row) } };
    const stripe = new StripeClient(config);
    const get = jest.fn().mockResolvedValue({ data: subscriptions });
    stripe.get = get as unknown as StripeClient['get'];
    const apply = { apply: jest.fn().mockResolvedValue('premium') };
    const service = new SeekerBillingService(
      prisma as unknown as PrismaService,
      config,
      stripe,
      apply as unknown as SeekerBillingWebhookService,
    );
    return { service, get, apply };
  }

  it("asks Stripe about the caller's own customer only, and applies the live subscription", async () => {
    const { service, get, apply } = harness({ stripeCustomerId: 'cus_candidate' }, [
      { id: 'sub_old', status: 'canceled', created: 300 },
      { id: 'sub_new', status: 'active', created: 200 },
    ]);
    const result = await service.sync(user);
    expect(get).toHaveBeenCalledWith('/subscriptions?customer=cus_candidate&status=all&limit=10');
    expect(apply.apply).toHaveBeenCalledWith(expect.objectContaining({ id: 'sub_new' }));
    expect(result.tier).toBe('premium');
  });

  it('asks nothing for someone who never started checkout', async () => {
    const { service, get, apply } = harness(null, []);
    await service.sync(user);
    expect(get).not.toHaveBeenCalled();
    expect(apply.apply).not.toHaveBeenCalled();
  });
});
