import 'reflect-metadata';
import { createHmac, randomUUID } from 'node:crypto';
import { BadGatewayException } from '@nestjs/common';
import { CompanyRole, UserRole } from '@prisma/client';
import { createTestDatabase } from './support/database';
import { createHiringApp } from './support/hiring-app';

describe('Company billing (PostgreSQL, signed webhooks)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let server: Awaited<ReturnType<typeof createHiringApp>>;
  let owner: string;
  let recruiter: string;
  let companyId: string;
  const checkout = { plan: 'PRO', interval: 'MONTHLY', successUrl: 'https://coral.example.test/billing/success', cancelUrl: 'https://coral.example.test/billing' };

  async function request(method: string, path: string, actor: string, body?: unknown) {
    const res = await fetch(`${server.baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${actor}` }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(25_000) });
    return { status: res.status, body: await res.json() };
  }
  async function webhook(type: string, object: unknown, options: { id?: string; signature?: string; timestamp?: number } = {}) {
    const id = options.id ?? `evt_${randomUUID()}`;
    // Whitespace deliberately differs from JSON.stringify(parsedBody).
    const payload = JSON.stringify({ id, type, data: { object } }, null, 2);
    const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
    const digest = createHmac('sha256', 'whsec_fixture_only').update(`${timestamp}.${payload}`).digest('hex');
    const res = await fetch(`${server.baseUrl}/payments/webhooks/stripe`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': options.signature ?? `t=${timestamp},v1=${digest}` }, body: payload, signal: AbortSignal.timeout(25_000) });
    return { id, status: res.status, body: await res.json() };
  }
  const subscription = (status = 'active', id = 'sub_fixture') => ({ id, customer: 'cus_fixture', status, metadata: { companyId }, currency: 'cad', current_period_start: 1_790_000_000, current_period_end: 1_793_000_000, cancel_at_period_end: false, items: { data: [{ price: { id: 'price_pro_month', unit_amount: 9900, recurring: { interval: 'month' } } }] } });

  beforeAll(async () => {
    database = await createTestDatabase();
    const users = await Promise.all([0, 1].map(() => { const id = randomUUID(); return database.prisma.user.create({ data: { id, supabaseId: randomUUID(), email: `${id}@example.test`, role: UserRole.EMPLOYER, status: 'ACTIVE' } }); }));
    [owner, recruiter] = users.map((u) => u.id);
    companyId = (await database.prisma.company.create({ data: { name: 'Billing fixtures', members: { create: [{ userId: owner, role: CompanyRole.OWNER }, { userId: recruiter, role: CompanyRole.RECRUITER }] } } })).id;
    server = await createHiringApp(database.prisma);
  }, 240_000);
  beforeEach(async () => {
    jest.clearAllMocks();
    server.delivery.stripePost.mockReset();
    server.delivery.stripeGet.mockReset();
    await database.prisma.companySubscription.deleteMany({ where: { companyId } });
  });
  afterAll(async () => { try { await server?.app.close(); } finally { await database?.close(); } });

  it('limits checkout to the owner and grants no plan merely for opening checkout', async () => {
    expect((await request('POST', '/employers/billing/checkout', recruiter, checkout)).status).toBe(403);
    expect(server.delivery.stripePost).not.toHaveBeenCalled();
    server.delivery.stripePost.mockImplementation(async (path: string) => path === '/customers' ? { id: 'cus_fixture' } : { id: 'cs_fixture', url: 'https://checkout.stripe.test/fixture' });
    expect((await request('POST', '/employers/billing/checkout', owner, checkout)).status).toBe(201);
    expect(server.delivery.stripePost).toHaveBeenCalledWith('/checkout/sessions', expect.objectContaining({ 'tax_id_collection[enabled]': 'true', 'subscription_data[metadata][companyId]': companyId, customer: 'cus_fixture' }));
    expect(await database.prisma.companySubscription.findUniqueOrThrow({ where: { companyId } })).toMatchObject({ plan: 'STARTER', status: 'NONE' });
    const overview = await request('GET', '/employers/billing/overview', recruiter);
    expect(overview.body.data.hasBillingAccount).toBe(true);
    expect(overview.body.data).not.toHaveProperty('stripeCustomerId');
    expect((await request('POST', '/employers/billing/portal', recruiter, { returnUrl: checkout.cancelUrl })).status).toBe(403);
    expect((await request('GET', '/employers/billing/invoices', recruiter)).status).toBe(403);
  });

  it('keeps one customer binding under concurrent checkout requests', async () => {
    const releases: ((value: { id: string }) => void)[] = [];
    let bothStarted!: () => void;
    const pending = new Promise<void>((resolve) => { bothStarted = resolve; });
    server.delivery.stripePost.mockImplementation((path: string) => path === '/customers' ? new Promise((resolve) => { releases.push(resolve); if (releases.length === 2) bothStarted(); }) : Promise.resolve({ id: 'cs_fixture', url: 'https://checkout.stripe.test/fixture' }));
    const requests = [0, 1].map(() => request('POST', '/employers/billing/checkout', owner, checkout));
    await pending;
    releases.forEach((release, i) => release({ id: `cus_race_${i}` }));
    expect((await Promise.all(requests)).map((r) => r.status)).toEqual([201, 201]);
    const stored = await database.prisma.companySubscription.findUniqueOrThrow({ where: { companyId } });
    const sessions = server.delivery.stripePost.mock.calls.filter(([path]) => path === '/checkout/sessions');
    expect(sessions.map(([, form]) => form.customer)).toEqual([stored.stripeCustomerId, stored.stripeCustomerId]);
    const keys = server.delivery.stripePost.mock.calls.filter(([path]) => path === '/customers').map(([, , key]) => key);
    expect(keys).toEqual([`company-customer-${companyId}`, `company-customer-${companyId}`]);
  });

  it('verifies the exact webhook payload and rejects forged or expired signatures', async () => {
    for (const options of [{ signature: 't=1,v1=forged' }, { timestamp: Math.floor(Date.now() / 1000) - 600 }]) {
      expect((await webhook('customer.subscription.updated', subscription(), options)).status).toBe(400);
    }
    expect(server.delivery.stripeGet).not.toHaveBeenCalled();
    server.delivery.stripeGet.mockResolvedValue(subscription());
    expect((await webhook('customer.subscription.updated', subscription())).status).toBe(201);
    expect(await database.prisma.companySubscription.findUniqueOrThrow({ where: { companyId } })).toMatchObject({ plan: 'PRO', status: 'ACTIVE', unitAmount: 9900 });
  });

  it('uses current Stripe state for delayed events and ignores completed event replays', async () => {
    server.delivery.stripeGet.mockResolvedValue(subscription('canceled'));
    const event = await webhook('customer.subscription.updated', subscription('active'));
    expect(event.status).toBe(201);
    expect(await database.prisma.companySubscription.findUniqueOrThrow({ where: { companyId } })).toMatchObject({ plan: 'STARTER', status: 'CANCELED' });
    const replay = await webhook('customer.subscription.updated', subscription('active'), { id: event.id });
    expect(replay.body.duplicate).toBe(true);
    expect(server.delivery.stripeGet).toHaveBeenCalledTimes(1);
  });

  it('retries provider failures without changing access or marking the event processed', async () => {
    await database.prisma.companySubscription.create({ data: { companyId, plan: 'PRO', status: 'ACTIVE', stripeCustomerId: 'cus_fixture', stripeSubscriptionId: 'sub_fixture' } });
    server.delivery.stripeGet.mockRejectedValueOnce(new BadGatewayException('Provider unavailable')).mockResolvedValue(subscription('canceled'));
    const event = await webhook('customer.subscription.deleted', subscription('canceled'));
    expect(event.status).toBe(502);
    expect((await database.prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { providerEventId: event.id } })).processingStatus).toBe('FAILED');
    expect((await database.prisma.companySubscription.findUniqueOrThrow({ where: { companyId } })).plan).toBe('PRO');
    expect((await webhook('customer.subscription.deleted', subscription('canceled'), { id: event.id })).status).toBe(201);
    expect((await database.prisma.companySubscription.findUniqueOrThrow({ where: { companyId } })).plan).toBe('STARTER');
  });

  it('does not cancel a replacement subscription or change access from invoice events', async () => {
    await database.prisma.companySubscription.create({ data: { companyId, plan: 'PRO', status: 'ACTIVE', stripeCustomerId: 'cus_fixture', stripeSubscriptionId: 'sub_replacement' } });
    server.delivery.stripeGet.mockResolvedValue(subscription('canceled', 'sub_old'));
    expect((await webhook('customer.subscription.deleted', subscription('canceled', 'sub_old'))).status).toBe(201);
    expect((await webhook('invoice.payment_failed', { id: 'in_fixture', customer: 'cus_fixture', amount_due: 9900, currency: 'cad' })).status).toBe(201);
    expect(await database.prisma.companySubscription.findUniqueOrThrow({ where: { companyId } })).toMatchObject({ plan: 'PRO', status: 'ACTIVE', stripeSubscriptionId: 'sub_replacement' });
    expect((await request('POST', '/employers/billing/checkout', owner, checkout)).status).toBe(400);
    expect(server.delivery.stripePost).not.toHaveBeenCalled();
  });
});
