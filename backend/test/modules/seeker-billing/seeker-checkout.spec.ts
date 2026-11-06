import { ConfigService } from '@nestjs/config';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { BillingInterval, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { StripeClient } from '../../../src/billing/stripe.client';
import { SeekerBillingService } from '../../../src/seeker-billing/seeker-billing.service';
import { User } from '../../../src/common/types/user.types';

/**
 * The Checkout session job seeker Premium actually asks Stripe for.
 *
 * Written after a hardcoded `automatic_tax[enabled]` made every Premium
 * checkout fail with `customer_tax_location_invalid` while employer checkout,
 * which gates the same setting behind STRIPE_AUTOMATIC_TAX, kept working.
 */
describe('job seeker Premium checkout session', () => {
  const user = {
    id: 'candidate',
    email: 'dev.candidate@coral.test',
    firstName: 'Dev',
    lastName: 'Candidate',
    role: 'JOB_SEEKER',
  } as User;

  let env: Record<string, string>;
  let prisma: Record<string, any>;
  let stripePost: jest.Mock;
  let service: SeekerBillingService;

  /** The form Stripe was posted for the checkout session. */
  const sessionForm = () =>
    stripePost.mock.calls.find(([path]) => path === '/checkout/sessions')?.[1] as Record<
      string,
      string
    >;

  beforeEach(() => {
    env = {
      STRIPE_SECRET_KEY: 'sk_test_fixture',
      STRIPE_PRICE_SEEKER_MONTHLY: 'price_monthly',
      STRIPE_PRICE_SEEKER_YEARLY: 'price_yearly',
      FRONTEND_URL: 'http://localhost:8081',
    };
    const config = {
      get: (key: string, fallback?: string) => env[key] ?? fallback,
    } as unknown as ConfigService;

    prisma = {
      userSubscription: {
        findUnique: jest.fn().mockResolvedValue({ stripeCustomerId: 'cus_candidate' }),
        upsert: jest.fn(),
      },
    };

    stripePost = jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.test/session' });
    const stripe = new StripeClient(config);
    stripe.post = stripePost as unknown as StripeClient['post'];

    service = new SeekerBillingService(prisma as unknown as PrismaService, config, stripe);
  });

  it('lets Stripe save the address it collects onto the customer', async () => {
    await service.checkout(user, BillingInterval.MONTHLY, '/premium');
    // ensureCustomer creates the customer with only an email and a name, so
    // without this the customer has no address and Stripe refuses the session.
    expect(sessionForm()['customer_update[address]']).toBe('auto');
    expect(sessionForm().billing_address_collection).toBe('required');
  });

  it('does not ask for automatic tax unless the account is set up for it', async () => {
    await service.checkout(user, BillingInterval.MONTHLY, '/premium');
    // A plain key read and a key list, not toHaveProperty: Jest reads
    // "automatic_tax[enabled]" as the path automatic_tax.enabled, so that
    // assertion passes whether or not the real key is there.
    expect(sessionForm()['automatic_tax[enabled]']).toBeUndefined();
    expect(Object.keys(sessionForm())).not.toContain('automatic_tax[enabled]');
  });

  it('asks for automatic tax once STRIPE_AUTOMATIC_TAX is on', async () => {
    env.STRIPE_AUTOMATIC_TAX = 'true';
    await service.checkout(user, BillingInterval.MONTHLY, '/premium');
    expect(sessionForm()['automatic_tax[enabled]']).toBe('true');
  });

  it('bills the chosen interval and routes the subscription to this product', async () => {
    await service.checkout(user, BillingInterval.YEARLY, '/premium');
    const form = sessionForm();
    expect(form['line_items[0][price]']).toBe('price_yearly');
    expect(form.mode).toBe('subscription');
    expect(form.customer).toBe('cus_candidate');
    // Without these the webhook cannot tell a seeker's subscription from an
    // employer's and would hand it to the wrong handler.
    expect(form['metadata[kind]']).toBe('jobseeker');
    expect(form['metadata[userId]']).toBe('candidate');
    expect(form['subscription_data[metadata][kind]']).toBe('jobseeker');
    expect(form['subscription_data[metadata][userId]']).toBe('candidate');
  });

  it('returns to this site, never to a caller-supplied address', async () => {
    await service.checkout(user, BillingInterval.MONTHLY, '//evil.test/steal');
    const form = sessionForm();
    expect(form.success_url).toBe('http://localhost:8081//evil.test/steal?checkout=success');
    expect(form.cancel_url).toBe('http://localhost:8081//evil.test/steal?checkout=cancelled');
  });

  it('refuses to sell a second Premium to someone who already has one', async () => {
    prisma.userSubscription.findUnique.mockResolvedValue({
      stripeCustomerId: 'cus_candidate',
      stripeSubscriptionId: 'sub_live',
      status: SubscriptionStatus.ACTIVE,
    });
    await expect(service.checkout(user, BillingInterval.MONTHLY, '/premium')).rejects.toThrow(
      BadRequestException,
    );
    expect(stripePost).not.toHaveBeenCalled();
  });

  it('says Premium is not on sale when its price is not configured', async () => {
    delete env.STRIPE_PRICE_SEEKER_MONTHLY;
    await expect(service.checkout(user, BillingInterval.MONTHLY, '/premium')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(stripePost).not.toHaveBeenCalled();
  });
});
