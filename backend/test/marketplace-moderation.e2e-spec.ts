import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { PrismaClient, UserRole } from '@prisma/client';
import { MarketplaceService } from '../src/marketplace/marketplace.service';
import { createTestDatabase } from './support/database';
import { createMarketplaceApp } from './support/marketplace-app';

describe('Phase 2 platform marketplace moderation (isolated PostgreSQL)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>, prisma: PrismaClient, app: INestApplication, baseUrl: string;
  const oldFlag = process.env.MARKETPLACE_LISTING_WRITES_ENABLED;
  async function actor(role: UserRole = 'JOB_SEEKER') {
    return prisma.user.create({ data: { supabaseId: randomUUID(), email: `${randomUUID()}@example.test`, role, status: 'ACTIVE' } });
  }
  async function request(method: string, path: string, userId: string | null, body?: unknown, expected = 200) {
    const response = await fetch(`${baseUrl}${path}`, { method,
      headers: { 'Content-Type': 'application/json', ...(userId ? { Authorization: `Bearer ${userId}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
    const payload = await response.json();
    expect({ status: response.status, ...(response.status === expected ? {} : { payload }) }).toEqual({ status: expected });
    return payload;
  }
  beforeAll(async () => {
    database = await createTestDatabase(); prisma = database.prisma;
    ({ app, baseUrl } = await createMarketplaceApp(prisma)); process.env.MARKETPLACE_LISTING_WRITES_ENABLED = 'true';
  }, 240_000);
  afterAll(async () => {
    if (oldFlag === undefined) delete process.env.MARKETPLACE_LISTING_WRITES_ENABLED; else process.env.MARKETPLACE_LISTING_WRITES_ENABLED = oldFlag;
    try { await app?.close(); } finally { await database?.close(); }
  });

  it('keeps the report queue admin-only, makes removal override every read, and records review separately', async () => {
    const owner = await actor(), reporter = await actor(), admin = await actor('ADMIN');
    const space = await prisma.space.create({ data: { slug: randomUUID(), name: 'Fixture space', createdById: reporter.id } });
    await prisma.spaceMember.create({ data: { spaceId: space.id, userId: reporter.id, role: 'MODERATOR' } });
    const helper = app.get(MarketplaceService);
    const draft = await helper.create('project', owner.id, { title: 'Canadian project needing review',
      description: 'Create a useful software prototype for a professional Canadian community.',
      scope: 'Design, build and document an accessible interface for project owners.', skills: ['React'], publicConsent: true });
    await helper.transition('project', draft.id, owner.id, 'open');
    await request('POST', `/gigs/${draft.id}/report`, reporter.id, { reason: 'fraud', details: 'Synthetic private report details' }, 201);
    for (const userId of [owner.id, reporter.id]) {
      await request('GET', '/marketplace/moderation/reports', userId, undefined, 403);
      await request('POST', `/marketplace/moderation/project/${draft.id}/remove`, userId, { reason: 'Unauthorized removal' }, 403);
    }
    await request('GET', '/marketplace/moderation/reports', null, undefined, 401);
    const report = (await request('GET', '/marketplace/moderation/reports', admin.id)).data[0];
    expect(report).toMatchObject({ reason: 'fraud', kind: 'project', target: { id: draft.id, removed: false } });
    expect(report).not.toHaveProperty('reporterId');
    await request('POST', `/marketplace/moderation/project/${draft.id}/remove`, admin.id, { reason: '  ' }, 400);
    process.env.MARKETPLACE_LISTING_WRITES_ENABLED = 'false';
    await request('POST', `/marketplace/moderation/project/${draft.id}/remove`, admin.id, { reason: 'Reviewed platform policy concern' }, 201);
    await request('GET', `/gigs/${draft.id}`, null, undefined, 404);
    expect(await helper.projectAnnouncementReference({ type: 'project', id: draft.id })).toBeNull();
    expect((await request('GET', '/marketplace/moderation/reports', admin.id)).data[0].target.removed).toBe(true);
    expect(await prisma.auditLog.count({ where: { entityId: draft.id, action: 'marketplace.listing.remove' } })).toBe(1);
    await request('POST', `/marketplace/moderation/reports/${report.id}/review`, admin.id, {}, 201);
    const reviewed = await prisma.marketplaceReport.findUniqueOrThrow({ where: { id: report.id } });
    expect(reviewed).toMatchObject({ status: 'reviewed', reviewedById: admin.id });
    expect(reviewed.reviewedAt).toBeInstanceOf(Date);
    await request('POST', `/marketplace/moderation/reports/${report.id}/review`, admin.id, {}, 201);
    expect((await prisma.marketplaceReport.findUniqueOrThrow({ where: { id: report.id } })).reviewedAt).toEqual(reviewed.reviewedAt);
    await request('POST', `/marketplace/moderation/project/${draft.id}/restore`, admin.id, {}, 201);
    await request('GET', `/gigs/${draft.id}`, null);
    await request('POST', `/gigs/${draft.id}/report`, reporter.id, { reason: 'fraud', details: 'Synthetic private report details' }, 201);
    expect((await prisma.marketplaceReport.findUniqueOrThrow({ where: { id: report.id } })).status).toBe('reviewed');
    await request('POST', `/gigs/${draft.id}/report`, reporter.id, { reason: 'fraud', details: 'A changed concern needs a fresh review' }, 201);
    expect(await prisma.marketplaceReport.findUniqueOrThrow({ where: { id: report.id } })).toMatchObject({ status: 'open', reviewedAt: null, reviewedById: null });
    await request('POST', `/marketplace/moderation/reports/${report.id}/review`, admin.id, {}, 201);
    await request('POST', `/gigs/${draft.id}/state`, owner.id, { status: 'closed' }, 201);
    await request('POST', `/marketplace/moderation/project/${draft.id}/remove`, admin.id, { reason: 'Rechecking a closed listing' }, 201);
    await request('POST', `/marketplace/moderation/project/${draft.id}/restore`, admin.id, {}, 201);
    const restored = await prisma.projectBrief.findUniqueOrThrow({ where: { id: draft.id } });
    expect(restored).toMatchObject({ status: 'closed', removedAt: null });
    await request('GET', `/gigs/${draft.id}`, null, undefined, 404);
    expect((await request('GET', '/marketplace/moderation/reports?status=reviewed', admin.id)).data).toHaveLength(1);
    await prisma.user.update({ where: { id: admin.id }, data: { status: 'INACTIVE' } });
    await request('POST', `/marketplace/moderation/project/${draft.id}/restore`, admin.id, {}, 403);
  });
});
