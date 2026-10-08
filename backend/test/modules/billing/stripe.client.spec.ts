import { ConfigService } from '@nestjs/config';
import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { StripeClient } from '../../../src/billing/stripe.client';

describe('Stripe transport', () => {
  afterEach(() => jest.restoreAllMocks());
  const client = () => new StripeClient(new ConfigService({ STRIPE_SECRET_KEY: 'sk_test_fixture' }));

  it('encodes form fields and sends an idempotency key and request deadline', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{"id":"cus_fixture"}'));
    await expect(client().post('/customers', { 'metadata[companyId]': 'company', optional: undefined }, 'company-customer-company')).resolves.toEqual({ id: 'cus_fixture' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.stripe.com/v1/customers', expect.objectContaining({
      method: 'POST', body: 'metadata%5BcompanyId%5D=company', signal: expect.any(AbortSignal),
      headers: expect.objectContaining({ 'Idempotency-Key': 'company-customer-company', 'Stripe-Version': '2024-06-20' }),
    }));
  });

  it('does not expose provider response details to API callers', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('private provider diagnostics', { status: 400 }));
    await expect(client().get('/subscriptions/sub_fixture')).rejects.toThrow('Billing provider request failed (400)');
  });

  it.each(['network', 'json'])('returns a billing gateway error for %s failure', async (kind) => {
    const fetchMock = jest.spyOn(global, 'fetch');
    if (kind === 'network') fetchMock.mockRejectedValue(new Error('timeout'));
    else fetchMock.mockResolvedValue(new Response('not-json'));
    await expect(client().get('/prices/fixture')).rejects.toThrow(BadGatewayException);
  });

  it('refuses requests with no configured secret', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(new StripeClient(new ConfigService({ STRIPE_SECRET_KEY: '' })).get('/prices/fixture')).rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
