import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Prisma, PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { setTimeout as delay } from 'node:timers/promises';
import { MarketplaceService } from '../src/marketplace/marketplace.service';
import { createTestDatabase } from './support/database';
import { createMarketplaceApp } from './support/marketplace-app';

describe('Phase 2 marketplace API (isolated PostgreSQL)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>, prisma: PrismaClient, app: INestApplication, baseUrl: string;
  const oldFlag = process.env.MARKETPLACE_LISTING_WRITES_ENABLED;
  async function user(role: UserRole = 'JOB_SEEKER', status: UserStatus = 'ACTIVE', provider = false) {
    const actor = await prisma.user.create({ data: { supabaseId: randomUUID(), email: `${randomUUID()}@example.test`, role, status, displayName: 'Marketplace professional' } });
    if (provider) await prisma.freelancerProfile.create({ data: { userId: actor.id, providerEnabled: true, publicPreviewEnabled: true, category: 'software', headline: 'Software professional', summary: 'I build professional software for growing Canadian teams.', skills: ['TypeScript'], expertise: [], portfolioUrl: 'https://work.example.test/portfolio' } });
    return actor;
  }
  const service = (label: string = randomUUID()) => ({ title: `Service ${label}`, description: 'A concrete professional service for Canadian teams to improve their software.', category: 'software', skills: ['TypeScript', 'typescript', 'Product Design'], deliverables: ['Working application', 'Handover documentation'], workSamples: [{ label: 'Relevant application', url: 'https://work.example.test/app' }], availability: 'available', workMode: 'remote', country: 'Canada', pricingMode: 'fixed', currency: 'CAD', amountMinor: 125000, publicConsent: true });
  const project = (label: string = randomUUID()) => ({ title: `Project ${label}`, description: 'A scoped software project for a Canadian community marketplace team.', scope: 'Build accessible marketplace screens and integrate tested canonical APIs.', category: 'software', skills: ['TypeScript'], workMode: 'remote', country: 'Canada', budgetMode: 'range', currency: 'CAD', minBudgetMinor: 100000, maxBudgetMinor: 250000, deadline: new Date(Date.now() + 30 * 86400000).toISOString(), publicConsent: true });
  async function request(method: string, path: string, actor: string | null = null, body?: unknown, expected = 200) {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${actor}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const payload = await response.json(); expect({ status: response.status, ...(response.status === expected ? {} : { payload }) }).toEqual({ status: expected }); return payload;
  }
  async function publishService(ownerId: string, fields = service()) { const created = (await request('POST', '/services', ownerId, fields, 201)).data; await request('POST', `/services/${created.id}/state`, ownerId, { status: 'published' }, 201); return created; }
  async function openProject(ownerId: string, fields = project()) { const created = (await request('POST', '/gigs', ownerId, fields, 201)).data; await request('POST', `/gigs/${created.id}/state`, ownerId, { status: 'open' }, 201); return created; }
  beforeAll(async () => { database = await createTestDatabase(); prisma = database.prisma; ({ app, baseUrl } = await createMarketplaceApp(prisma)); }, 240000);
  beforeEach(() => { process.env.MARKETPLACE_LISTING_WRITES_ENABLED = 'true'; });
  afterAll(async () => { if (oldFlag === undefined) delete process.env.MARKETPLACE_LISTING_WRITES_ENABLED; else process.env.MARKETPLACE_LISTING_WRITES_ENABLED = oldFlag; try { await app?.close(); } finally { await database?.close(); } });

  it('persists drafts, isolates owner reloads and rejects forged ownership and status', async () => {
    const owner = await user('JOB_SEEKER', 'ACTIVE', true), stranger = await user('FREELANCER', 'ACTIVE', true);
    const draft = (await request('POST', '/services', owner.id, { title: 'Unfinished draft' }, 201)).data;
    expect(draft).toMatchObject({ status: 'draft', ownerUserId: owner.id, publicConsent: false, currency: 'CAD' });
    expect((await request('GET', `/services/mine/${draft.id}`, owner.id)).data.id).toBe(draft.id);
    await request('GET', `/services/${draft.id}`, owner.id, undefined, 404);
    await request('GET', `/services/mine/${draft.id}`, stranger.id, undefined, 404);
    await request('PATCH', `/services/${draft.id}`, stranger.id, { title: 'Takeover' }, 404);
    for (const forged of [{ ownerUserId: stranger.id }, { status: 'published' }, { removedAt: null }, { companyId: randomUUID() }]) await request('PATCH', `/services/${draft.id}`, owner.id, forged, 400);
    await request('POST', '/services', owner.id, { ownerUserId: stranger.id }, 400);
    expect((await prisma.serviceListing.findUniqueOrThrow({ where: { id: draft.id } })).title).toBe('Unfinished draft');
  });
  it('publishes only complete consented services and preserves jobseeker identity', async () => {
    const owner = await user('JOB_SEEKER', 'ACTIVE', true);
    const draft = (await request('POST', '/services', owner.id, {}, 201)).data;
    await request('POST', `/services/${draft.id}/state`, owner.id, { status: 'published' }, 400);
    await request('PATCH', `/services/${draft.id}`, owner.id, service());
    await request('POST', `/services/${draft.id}/state`, owner.id, { status: 'published' }, 201);
    const publicRecord = (await request('GET', `/services/${draft.id}`, owner.id)).data;
    expect(publicRecord).toMatchObject({ id: draft.id, amountMinor: 125000, currency: 'CAD', skills: ['TypeScript', 'Product Design'], owner: { profileUrl: `/providers/${owner.id}` } });
    for (const field of ['ownerUserId', 'publicConsent', 'permissions', 'removedAt', 'email', 'reports', 'normalizedSkills']) expect(publicRecord).not.toHaveProperty(field);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).role).toBe('JOB_SEEKER');
  });
  it('requires active provider capability and current public preview consent', async () => {
    const privateOwner = await user('FREELANCER', 'ACTIVE', true);
    await prisma.freelancerProfile.update({ where: { userId: privateOwner.id }, data: { publicPreviewEnabled: false } });
    const record = (await request('POST', '/services', privateOwner.id, service(), 201)).data;
    await request('POST', `/services/${record.id}/state`, privateOwner.id, { status: 'published' }, 400);
    const disabledProvider = await user(); await request('POST', '/services', disabledProvider.id, service(), 403);
    const employer = await user('EMPLOYER'); await request('POST', '/services', employer.id, service(), 403);
    const inactive = await user('JOB_SEEKER', 'INACTIVE', true); await request('POST', '/services', inactive.id, service(), 403);
    await request('POST', '/services', null, service(), 401);
  });
  it('publishes after a brief database lock without expiring the permission-checked transaction', async () => {
    const owner = await user('JOB_SEEKER', 'ACTIVE', true);
    const helper = app.get(MarketplaceService);
    const draft = await helper.create('service', owner.id, service());
    let locked!: () => void;
    const acquired = new Promise<void>(resolve => { locked = resolve; });
    const holding = prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM service_listings WHERE id = ${draft.id} FOR UPDATE`);
      locked();
      await delay(6_000);
    }, { timeout: 15_000 });
    // Surface acquisition errors rather than hanging on the readiness promise.
    await Promise.race([acquired, holding]);
    const [published] = await Promise.all([helper.transition('service', draft.id, owner.id, 'published'), holding]);
    expect(published.status).toBe('published');
    expect((await helper.getPublic('service', draft.id)).id).toBe(draft.id);
  });
  it('rechecks the original publisher when a different company administrator publishes', async () => {
    const owner = await user('EMPLOYER'), administrator = await user('EMPLOYER');
    const company = await prisma.company.create({ data: { name: 'Publisher authority fixture' } });
    const seat = await prisma.companyMember.create({ data: { companyId: company.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' } });
    await prisma.companyMember.create({ data: { companyId: company.id, userId: administrator.id, role: 'ADMIN', status: 'ACTIVE' } });
    const helper = app.get(MarketplaceService);
    const draft = await helper.create('project', owner.id, { ...project(), companyId: company.id });
    await prisma.companyMember.update({ where: { id: seat.id }, data: { status: 'REMOVED' } });
    await request('POST', `/gigs/${draft.id}/state`, administrator.id, { status: 'open' }, 403);
    expect((await prisma.projectBrief.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe('draft');
  });
  it('filters consent, current company seats and inactive owners before pagination and totals', async () => {
    const marker = randomUUID(), visibleOwner = await user('FREELANCER', 'ACTIVE', true), hiddenOwner = await user('JOB_SEEKER', 'ACTIVE', true);
    const visible = await publishService(visibleOwner.id, service(marker)); await publishService(hiddenOwner.id, service(marker));
    await prisma.freelancerProfile.update({ where: { userId: hiddenOwner.id }, data: { publicPreviewEnabled: false } });
    const company = await prisma.company.create({ data: { name: 'Marketplace Canadian company' } });
    const seat = await prisma.companyMember.create({ data: { companyId: company.id, userId: visibleOwner.id, role: 'OWNER', status: 'ACTIVE' } });
    await publishService(visibleOwner.id, { ...service(marker), companyId: company.id } as any);
    await prisma.companyMember.update({ where: { id: seat.id }, data: { status: 'REMOVED' } });
    const list = await request('GET', `/services?q=${marker}&skill=typescript&page=1&limit=1&category=software`);
    expect(list.meta).toMatchObject({ total: 1, totalPages: 1 }); expect(list.data.map((v: any) => v.id)).toEqual([visible.id]);
    await prisma.user.update({ where: { id: visibleOwner.id }, data: { status: 'INACTIVE' } });
    expect((await request('GET', `/services?q=${marker}`)).meta.total).toBe(0);
    await request('GET', `/services/${visible.id}`, null, undefined, 404);
  });
  it('uses literal search punctuation, exact normalized skills and bounded pagination', async () => {
    const owner = await user('FREELANCER', 'ACTIVE', true), marker = `${randomUUID()}%_`;
    const listing = await publishService(owner.id, service(marker));
    expect((await request('GET', `/services?q=${encodeURIComponent(marker)}&skill=TYPEscript`)).data.map((v: any) => v.id)).toEqual([listing.id]);
    expect((await request('GET', `/services?q=${encodeURIComponent(marker)}&skill=Type`)).data).toEqual([]);
    for (const path of ['/services?limit=100', '/services?page=-1', '/services?category=medical', '/gigs?workMode=unknown']) await request('GET', path, null, undefined, 400);
  });
  it('persists personal and company project briefs and rechecks seat capability on each mutation', async () => {
    const client = await user(); const personal = await openProject(client.id); expect((await request('GET', `/gigs/${personal.id}`)).data.scope.length).toBeGreaterThan(30);
    const employer = await user('EMPLOYER'), recruiter = await user('EMPLOYER');
    const company = await prisma.company.create({ data: { name: 'Project client company' } });
    const seat = await prisma.companyMember.create({ data: { companyId: company.id, userId: employer.id, role: 'OWNER', status: 'ACTIVE' } });
    await prisma.companyMember.create({ data: { companyId: company.id, userId: recruiter.id, role: 'RECRUITER', status: 'ACTIVE' } });
    await request('POST', '/gigs', employer.id, project(), 403);
    await request('POST', '/gigs', recruiter.id, { ...project(), companyId: company.id }, 403);
    const brief = await openProject(employer.id, { ...project(), companyId: company.id } as any);
    await request('PATCH', `/gigs/${brief.id}`, recruiter.id, { title: 'Recruiter cannot publish' }, 403);
    expect((await request('GET', '/marketplace/capabilities', employer.id)).data.companies).toEqual([{ id: company.id, name: company.name }]);
    await prisma.companyMember.update({ where: { id: seat.id }, data: { role: 'RECRUITER' } });
    await request('POST', `/gigs/${brief.id}/state`, employer.id, { status: 'closed' }, 403);
    await request('GET', `/gigs/${brief.id}`, null, undefined, 404);
  });
  it('validates currency exponents, integer money, paired ranges, HTTPS links and deadlines', async () => {
    const owner = await user('FREELANCER', 'ACTIVE', true);
    for (const fields of [{ amountMinor: 1.2 }, { currency: 'ZZZ' }, { amountMinor: -1 }, { workSamples: [{ label: 'Work', url: 'https://user:password@example.test' }] }, { workSamples: [{ label: 'Work', url: 'javascript:alert(1)' }] }]) await request('POST', '/services', owner.id, { ...service(), ...fields }, 400);
    for (const fields of [{ minBudgetMinor: 500, maxBudgetMinor: 100 }, { budgetMode: 'fixed', minBudgetMinor: 100, maxBudgetMinor: 200 }, { deadline: 'not-a-date' }]) await request('POST', '/gigs', owner.id, { ...project(), ...fields }, 400);
    const yen = await publishService(owner.id, { ...service(), currency: 'JPY', amountMinor: 1500 }); expect((await request('GET', `/services/${yen.id}`)).data.amountMinor).toBe(1500);
    expect((await request('GET', '/marketplace/capabilities')).data.currencies).toMatchObject({ JPY: 0, KWD: 3, CAD: 2 });
    const expired = (await request('POST', '/gigs', owner.id, { ...project(), deadline: new Date(Date.now() - 86400000).toISOString() }, 201)).data;
    await request('POST', `/gigs/${expired.id}/state`, owner.id, { status: 'open' }, 400);
  });
  it('preserves authorized history, pause/close/archive/report when writes are disabled', async () => {
    const owner = await user('FREELANCER', 'ACTIVE', true), reporter = await user(); const listing = await publishService(owner.id), brief = await openProject(owner.id);
    process.env.MARKETPLACE_LISTING_WRITES_ENABLED = 'TRUE';
    expect((await request('GET', '/marketplace/capabilities', owner.id)).data.listingWritesEnabled).toBe(false);
    await request('POST', '/services', owner.id, service(), 403); await request('PATCH', `/services/${listing.id}`, owner.id, { title: 'Disabled write' }, 403);
    expect((await request('GET', `/services/mine/${listing.id}`, owner.id)).data.permissions.canPause).toBe(true);
    await request('POST', `/services/${listing.id}/report`, reporter.id, { reason: 'spam', details: 'Please review this listing.' }, 201);
    await request('POST', `/services/${listing.id}/report`, reporter.id, { reason: 'fraud', details: 'Updated report' }, 201);
    expect(await prisma.marketplaceReport.count({ where: { serviceListingId: listing.id, reporterId: reporter.id } })).toBe(1);
    await request('POST', `/services/${listing.id}/report`, reporter.id, { reason: 'unapproved' }, 400);
    await request('POST', `/services/${listing.id}/state`, owner.id, { status: 'paused' }, 201); await request('GET', `/services/${listing.id}`, null, undefined, 404);
    await request('POST', `/services/${listing.id}/state`, owner.id, { status: 'published' }, 403);
    await request('POST', `/gigs/${brief.id}/state`, owner.id, { status: 'closed' }, 201); await request('GET', `/gigs/${brief.id}`, null, undefined, 404);
    await request('POST', `/gigs/${brief.id}/state`, owner.id, { status: 'archived' }, 201);
    process.env.MARKETPLACE_LISTING_WRITES_ENABLED = 'true'; await request('POST', `/gigs/${brief.id}/state`, owner.id, { status: 'open' }, 400);
  });
  it('withdraws listing consent and rejects stale state and community references', async () => {
    const owner = await user('JOB_SEEKER', 'ACTIVE', true), listing = await publishService(owner.id);
    await request('PATCH', `/services/${listing.id}`, owner.id, { publicConsent: false });
    expect((await request('GET', `/services/mine/${listing.id}`, owner.id)).data).toMatchObject({ status: 'paused', publicConsent: false });
    const helper = app.get(MarketplaceService); expect(await helper.projectAnnouncementReference({ type: 'service', id: listing.id })).toBeNull();
    await expect(helper.validateAnnouncementReference(owner.id, { type: 'service', id: listing.id })).rejects.toThrow();
    await request('POST', `/services/${listing.id}/state`, owner.id, { status: 'published' }, 400);
    const brief = await openProject(owner.id); await prisma.projectBrief.update({ where: { id: brief.id }, data: { removedAt: new Date() } });
    await request('GET', `/gigs/${brief.id}`, null, undefined, 404); await request('POST', `/gigs/${brief.id}/state`, owner.id, { status: 'open' }, 400);
    expect(await helper.projectAnnouncementReference({ type: 'project', id: brief.id })).toBeNull();
  });
});
