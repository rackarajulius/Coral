import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createTestDatabase } from './support/database';

// Rehearses only the delivered additive SQL inside this suite's owned schema.
describe('Phase 3 marketplace request migration (isolated PostgreSQL)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>, prisma: PrismaClient;
  let requesterId: string, recipientId: string, serviceId: string, projectId: string;
  beforeAll(async () => { database = await createTestDatabase(); prisma = database.prisma; }, 240_000);
  afterAll(async () => { await database?.close(); });
  const requestData = () => ({ kind: 'service', serviceListingId: serviceId, requesterId, recipientId, body: 'A private introduction with a concrete project scope.', idempotencyKey: randomUUID(), payloadHash: 'fixture-hash' });

  it('preserves Phase 2 profiles, canonical listings, linked posts and existing hiring records', async () => {
    const requester = await prisma.user.create({ data: { supabaseId: randomUUID(), email: `${randomUUID()}@example.test`, role: 'JOB_SEEKER', status: 'ACTIVE' } });
    const recipient = await prisma.user.create({ data: { supabaseId: randomUUID(), email: `${randomUUID()}@example.test`, role: 'EMPLOYER', status: 'ACTIVE' } });
    requesterId = requester.id; recipientId = recipient.id;
    const profile = await prisma.freelancerProfile.create({ data: { userId: requesterId, providerEnabled: true, publicPreviewEnabled: false, skills: ['Figma'], expertise: [] } });
    const service = await prisma.serviceListing.create({ data: { ownerUserId: recipientId, title: 'An existing service', status: 'published', publicConsent: true } });
    const project = await prisma.projectBrief.create({ data: { ownerUserId: recipientId, title: 'An existing project', status: 'open', publicConsent: true } });
    serviceId = service.id; projectId = project.id;
    const post = await prisma.post.create({ data: { authorId: recipientId, content: 'Existing service announcement', postType: 'TEXT', purpose: 'SERVICE_ANNOUNCEMENT', linkedServiceListingId: serviceId, mediaUrls: [], hashtags: [] } });
    const job = await prisma.job.create({ data: { postedById: recipientId, title: 'Existing Canadian job', slug: randomUUID(), description: 'Existing hiring data remains intact.', employmentType: 'full-time', status: 'active', publishedAt: new Date(), skills: ['Figma'] } });
    const application = await prisma.application.create({ data: { jobId: job.id, applicantId: requesterId, status: 'pending' } });
    const usersBefore = await prisma.user.findMany({ orderBy: { id: 'asc' } });
    const sql = await readFile(resolve(__dirname, '../prisma/migrations/20261007160000_phase3_marketplace/migration.sql'), 'utf8');
    expect(sql).not.toMatch(/\$\$/);
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    await prisma.$transaction(async tx => {
      const [{ schema }] = await tx.$queryRaw<Array<{ schema: string }>>`SELECT current_schema() AS schema`;
      if (!/^coral_e2e_[a-f0-9]{32}$/.test(schema)) throw new Error('Refusing DDL outside the generated owned schema');
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      for (const table of ['marketplace_deliveries', 'marketplace_request_reports', 'marketplace_messages', 'marketplace_blocks', 'marketplace_events', 'marketplace_requests']) await tx.$executeRawUnsafe(`DROP TABLE "${schema}"."${table}"`);
      for (const statement of statements) await tx.$executeRawUnsafe(statement.replaceAll('"public"', `"${schema}"`));
    }, { timeout: 30_000 });
    expect(await prisma.user.findMany({ orderBy: { id: 'asc' } })).toEqual(usersBefore);
    expect(await prisma.freelancerProfile.findUniqueOrThrow({ where: { id: profile.id } })).toEqual(profile);
    expect(await prisma.serviceListing.findUniqueOrThrow({ where: { id: serviceId } })).toEqual(service);
    expect(await prisma.projectBrief.findUniqueOrThrow({ where: { id: projectId } })).toEqual(project);
    expect(await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).toEqual(post);
    expect(await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).toEqual(job);
    expect(await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).toEqual(application);
    expect(await prisma.marketplaceRequest.count()).toBe(0);
    expect(await prisma.marketplaceMessage.count()).toBe(0);
    expect(await prisma.marketplaceDelivery.count()).toBe(0);
  });

  it('enforces canonical target, participant, lifecycle and unique retry constraints in PostgreSQL', async () => {
    const created = await prisma.marketplaceRequest.create({ data: requestData() });
    expect(created).toMatchObject({ status: 'pending', acceptedAt: null, workSamples: [] });
    // Update the valid row so its target uniqueness cannot mask missing CHECKs.
    for (const data of [
      { serviceListingId: null },
      { requesterId: recipientId },
      { kind: 'project' },
      { projectBriefId: projectId },
      { status: 'open' },
      { body: '   ' },
      { workSamples: {} },
    ]) await expect(prisma.marketplaceRequest.update({ where: { id: created.id }, data })).rejects.toThrow();
    await expect(prisma.marketplaceRequest.create({ data: { ...requestData(), kind: 'project', serviceListingId: null, projectBriefId: projectId, idempotencyKey: created.idempotencyKey } })).rejects.toThrow();
    await expect(prisma.marketplaceRequest.create({ data: requestData() })).rejects.toThrow();
    await expect(prisma.marketplaceMessage.create({ data: { requestId: created.id, senderId: requesterId, body: ' ', idempotencyKey: randomUUID(), payloadHash: 'hash' } })).rejects.toThrow();
    await expect(prisma.marketplaceBlock.create({ data: { blockerId: requesterId, blockedId: requesterId } })).rejects.toThrow();
    const message = await prisma.marketplaceMessage.create({ data: { requestId: created.id, senderId: requesterId, body: 'A valid reply', idempotencyKey: randomUUID(), payloadHash: 'hash' } });
    await expect(prisma.marketplaceMessage.create({ data: { requestId: created.id, senderId: requesterId, body: 'Another reply', idempotencyKey: message.idempotencyKey, payloadHash: 'another-hash' } })).rejects.toThrow();
  });

  it('cascades sensitive introductions and their messages, reports and outbox on participant or company deletion', async () => {
    const request = await prisma.marketplaceRequest.findFirstOrThrow({ where: { requesterId } });
    await prisma.marketplaceRequestReport.create({ data: { requestId: request.id, reporterId: requesterId, reason: 'spam' } });
    const event = await prisma.marketplaceEvent.create({ data: { type: 'request_submitted', entityType: 'request', entityId: request.id, requestId: request.id, actorId: requesterId, dedupeKey: randomUUID() } });
    await prisma.marketplaceDelivery.create({ data: { requestId: request.id, userId: recipientId, eventId: event.id } });
    await prisma.marketplaceBlock.create({ data: { blockerId: recipientId, blockedId: requesterId } });
    await prisma.user.delete({ where: { id: requesterId } });
    expect(await prisma.marketplaceEvent.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ actorId: null, properties: {} });
    for (const count of [await prisma.marketplaceRequest.count(), await prisma.marketplaceMessage.count(), await prisma.marketplaceRequestReport.count(), await prisma.marketplaceDelivery.count(), await prisma.marketplaceBlock.count()]) expect(count).toBe(0);
    expect(await prisma.serviceListing.findUnique({ where: { id: serviceId } })).not.toBeNull();
    const replacement = await prisma.user.create({ data: { supabaseId: randomUUID(), email: `${randomUUID()}@example.test`, role: 'JOB_SEEKER', status: 'ACTIVE' } });
    const company = await prisma.company.create({ data: { name: 'Saved company context' } });
    const companyRequest = await prisma.marketplaceRequest.create({ data: { ...requestData(), requesterId: replacement.id, requesterCompanyId: company.id } });
    const companyEvent = await prisma.marketplaceEvent.create({ data: { type: 'project_response_submitted', entityType: 'request', entityId: companyRequest.id, companyId: company.id, dedupeKey: randomUUID() } });
    await prisma.company.delete({ where: { id: company.id } });
    expect(await prisma.marketplaceRequest.findUnique({ where: { id: companyRequest.id } })).toBeNull();
    expect(await prisma.marketplaceEvent.findUniqueOrThrow({ where: { id: companyEvent.id } })).toMatchObject({ companyId: null, properties: {} });
  });
});
