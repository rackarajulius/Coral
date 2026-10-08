import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { MarketplaceActivityService } from '../src/marketplace/marketplace-activity.service';
import { createTestDatabase } from './support/database';
import { createMarketplaceRequestsApp } from './support/marketplace-requests-app';

describe('Phase 3 private marketplace requests (isolated PostgreSQL)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>, prisma: PrismaClient, app: INestApplication, baseUrl: string, activity: MarketplaceActivityService;
  const oldEnquiries = process.env.MARKETPLACE_ENQUIRIES_ENABLED, oldWrites = process.env.MARKETPLACE_LISTING_WRITES_ENABLED;
  async function user(role: UserRole = 'JOB_SEEKER', status: UserStatus = 'ACTIVE') {
    return prisma.user.create({ data: { supabaseId: randomUUID(), email: `${randomUUID()}@example.test`, role, status, displayName: 'Canadian marketplace member' } });
  }
  async function service(ownerId: string, fields: Record<string, unknown> = {}) {
    await prisma.freelancerProfile.upsert({ where: { userId: ownerId }, update: {}, create: { userId: ownerId, providerEnabled: true, publicPreviewEnabled: true, category: 'software', headline: 'Software professional', summary: 'I build professional software for growing Canadian teams.', skills: ['TypeScript'], expertise: [], portfolioUrl: 'https://work.example.test/portfolio' } });
    return prisma.serviceListing.create({ data: { ownerUserId: ownerId, title: `Canadian software service ${randomUUID()}`, description: 'A concrete professional service for Canadian teams to improve their software.', category: 'software', skills: ['TypeScript'], normalizedSkills: ['typescript'], deliverables: ['Working software', 'Handover documentation'], workSamples: [{ label: 'Relevant work', url: 'https://work.example.test/app' }], publicConsent: true, status: 'published', publishedAt: new Date(), ...fields } });
  }
  async function project(ownerId: string, fields: Record<string, unknown> = {}) {
    return prisma.projectBrief.create({ data: { ownerUserId: ownerId, title: `Canadian software project ${randomUUID()}`, description: 'A scoped software project for a Canadian community marketplace team.', scope: 'Build accessible marketplace screens and integrate tested canonical APIs.', category: 'software', skills: ['TypeScript'], normalizedSkills: ['typescript'], publicConsent: true, status: 'open', publishedAt: new Date(), deadline: new Date(Date.now() + 30 * 86400000), ...fields } });
  }
  const introduction = (listingId: string, kind: 'service' | 'project' = 'service', fields: Record<string, unknown> = {}) => ({ kind, listingId, body: 'We need an accessible software project for our Canadian team. Please discuss the scope privately.', workSamples: [{ label: 'Our public brief', url: 'https://work.example.test/brief' }], idempotencyKey: randomUUID(), ...fields });
  const message = (body = 'Thanks, I can help with that scoped software project.') => ({ body, idempotencyKey: randomUUID() });
  async function request(method: string, path: string, actor: string | null = null, body?: unknown, expected = 200) {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${actor}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
    const payload = await response.json(); expect({ status: response.status, ...(response.status === expected ? {} : { payload }) }).toEqual({ status: expected }); return payload;
  }
  async function submit(actorId: string, listingId: string, kind: 'service' | 'project' = 'service', fields: Record<string, unknown> = {}) { return (await request('POST', '/marketplace/requests', actorId, introduction(listingId, kind, fields), 201)).data; }
  async function state(actorId: string, id: string, action: string, expected = 201) { return (await request('POST', `/marketplace/requests/${id}/state`, actorId, { action }, expected)).data; }
  beforeAll(async () => { database = await createTestDatabase(); prisma = database.prisma; ({ app, baseUrl } = await createMarketplaceRequestsApp(prisma)); activity = app.get(MarketplaceActivityService); }, 240_000);
  beforeEach(() => { process.env.MARKETPLACE_ENQUIRIES_ENABLED = 'true'; process.env.MARKETPLACE_LISTING_WRITES_ENABLED = 'true'; });
  afterAll(async () => {
    if (oldEnquiries === undefined) delete process.env.MARKETPLACE_ENQUIRIES_ENABLED; else process.env.MARKETPLACE_ENQUIRIES_ENABLED = oldEnquiries;
    if (oldWrites === undefined) delete process.env.MARKETPLACE_LISTING_WRITES_ENABLED; else process.env.MARKETPLACE_LISTING_WRITES_ENABLED = oldWrites;
    try { await app?.close(); } finally { await database?.close(); }
  });

  it('requires active authenticated requesters and discloses no private data through anonymous capabilities or public listing cards', async () => {
    const owner = await user(), requester = await user(), inactive = await user('JOB_SEEKER', 'INACTIVE'), listing = await service(owner.id);
    const capabilityPath = `/marketplace/requests/capabilities?kind=service&listingId=${listing.id}`;
    expect((await request('GET', capabilityPath)).data).toEqual({ enquiriesEnabled: true, canSubmit: false, reason: 'sign_in_required' });
    await request('POST', '/marketplace/requests', null, introduction(listing.id), 401);
    await request('POST', '/marketplace/requests', inactive.id, introduction(listing.id), 403);
    const created = await submit(requester.id, listing.id);
    expect(created).toMatchObject({ status: 'pending', viewerSide: 'requester', permissions: { canAccept: false, canSend: false, canWithdraw: true } });
    const recipient = (await request('GET', `/marketplace/requests/${created.id}`, owner.id)).data;
    expect(recipient).toMatchObject({ body: created.body, unreadCount: 1, permissions: { canAccept: true, canSend: true } });
    await request('POST', `/marketplace/requests/${created.id}/messages`, requester.id, message(), 403);
    const publicCard = (await request('GET', `/services/${listing.id}`)).data;
    for (const key of ['body', 'requests', 'requester', 'recipient', 'email', 'messages', 'workSamplesPrivate']) expect(publicCard).not.toHaveProperty(key);
    const compact = (await request('GET', '/marketplace/requests?box=outgoing', requester.id)).data[0];
    for (const key of ['body', 'workSamples', 'payloadHash', 'idempotencyKey', 'requesterLastReadAt']) expect(compact).not.toHaveProperty(key);
    const ownCapability = (await request('GET', capabilityPath, requester.id)).data;
    expect(ownCapability).toMatchObject({ canSubmit: false, reason: 'existing_request', existingRequestId: created.id });
  });

  it('keeps each introduction between its two named people despite company ownership, moderation or admin roles', async () => {
    const owner = await user(), otherOwner = await user('EMPLOYER'), requester = await user(), stranger = await user(), admin = await user('ADMIN'), moderator = await user();
    const company = await prisma.company.create({ data: { name: 'Recipient company' } });
    for (const actor of [owner, otherOwner]) await prisma.companyMember.create({ data: { userId: actor.id, companyId: company.id, role: 'OWNER', status: 'ACTIVE' } });
    const space = await prisma.space.create({ data: { name: 'Marketplace testing space', slug: randomUUID(), createdById: moderator.id } });
    await prisma.spaceMember.create({ data: { userId: moderator.id, spaceId: space.id, role: 'MODERATOR' } });
    const listing = await service(owner.id, { companyId: company.id }), created = await submit(requester.id, listing.id);
    for (const actor of [otherOwner, stranger, admin, moderator]) {
      await request('GET', `/marketplace/requests/${created.id}`, actor.id, undefined, 404);
      await request('GET', `/marketplace/requests/${created.id}/messages`, actor.id, undefined, 404);
      await request('POST', `/marketplace/requests/${created.id}/read`, actor.id, {}, 404);
      await request('POST', `/marketplace/requests/${created.id}/messages`, actor.id, message(), 404);
      await state(actor.id, created.id, 'accept', 404);
      expect((await request('GET', '/marketplace/requests', actor.id)).meta.total).toBe(0);
    }
    await request('GET', `/marketplace/requests/${created.id}`, null, undefined, 401);
    await request('GET', '/marketplace/requests?requesterId=forged', requester.id, undefined, 400);
  });

  it('rejects self and own-company contact and forged participant/company attribution', async () => {
    const owner = await user(), member = await user(), outsider = await user(), recruiter = await user('EMPLOYER');
    const company = await prisma.company.create({ data: { name: 'Own company' } });
    for (const [actor, role] of [[owner, 'OWNER'], [member, 'VIEWER'], [recruiter, 'RECRUITER']] as const) await prisma.companyMember.create({ data: { companyId: company.id, userId: actor.id, role, status: 'ACTIVE' } });
    const listing = await service(owner.id, { companyId: company.id });
    await request('POST', '/marketplace/requests', owner.id, introduction(listing.id), 403);
    await request('POST', '/marketplace/requests', member.id, introduction(listing.id), 403);
    await request('POST', '/marketplace/requests', outsider.id, introduction(listing.id, 'service', { companyId: company.id }), 403);
    await request('POST', '/marketplace/requests', recruiter.id, introduction(listing.id, 'service', { companyId: company.id }), 403);
    for (const field of [{ recipientId: outsider.id }, { requesterId: owner.id }, { status: 'accepted' }]) await request('POST', '/marketplace/requests', outsider.id, { ...introduction(listing.id), ...field }, 400);
    expect(await prisma.marketplaceRequest.count({ where: { serviceListingId: listing.id } })).toBe(0);
  });

  it('deduplicates concurrent requests, rejects key reuse with changed content and preserves exact retries after closure or flag disablement', async () => {
    const owner = await user(), requester = await user(), listing = await service(owner.id), dto = introduction(listing.id);
    const results = await Promise.all([request('POST', '/marketplace/requests', requester.id, dto, 201), request('POST', '/marketplace/requests', requester.id, dto, 201)]);
    expect(results[0].data.id).toBe(results[1].data.id);
    expect(await prisma.marketplaceRequest.count({ where: { serviceListingId: listing.id, requesterId: requester.id } })).toBe(1);
    await request('POST', '/marketplace/requests', requester.id, { ...dto, body: 'This is a different private introduction with the same key.' }, 409);
    await request('POST', '/marketplace/requests', requester.id, introduction(listing.id), 409);
    await prisma.serviceListing.update({ where: { id: listing.id }, data: { status: 'paused' } });
    process.env.MARKETPLACE_ENQUIRIES_ENABLED = 'false';
    expect((await request('POST', '/marketplace/requests', requester.id, dto, 201)).data.id).toBe(results[0].data.id);
    expect(await prisma.marketplaceEvent.count({ where: { requestId: results[0].data.id, type: 'service_enquiry_submitted' } })).toBe(1);
    expect(await prisma.marketplaceDelivery.count({ where: { requestId: results[0].data.id } })).toBe(1);
  });

  it('accepts once and atomically accepts a first recipient reply, with message retry integrity', async () => {
    const owner = await user(), requester = await user(), listing = await service(owner.id), created = await submit(requester.id, listing.id);
    await state(requester.id, created.id, 'accept', 403);
    await Promise.all([state(owner.id, created.id, 'accept'), state(owner.id, created.id, 'accept')]);
    expect(await prisma.marketplaceEvent.count({ where: { requestId: created.id, type: 'marketplace_request_accepted' } })).toBe(1);
    const dto = message('A private recipient reply that must stay out of analytics and notifications.');
    const replies = await Promise.all([request('POST', `/marketplace/requests/${created.id}/messages`, owner.id, dto, 201), request('POST', `/marketplace/requests/${created.id}/messages`, owner.id, dto, 201)]);
    expect(replies[0].data.id).toBe(replies[1].data.id);
    await request('POST', `/marketplace/requests/${created.id}/messages`, owner.id, { ...dto, body: 'A changed message' }, 409);
    expect(await prisma.marketplaceMessage.count({ where: { requestId: created.id } })).toBe(1);
    expect(await prisma.marketplaceEvent.count({ where: { requestId: created.id, type: 'marketplace_recipient_replied' } })).toBe(1);
    const brief = await project(owner.id), pending = await submit(requester.id, brief.id, 'project');
    await request('POST', `/marketplace/requests/${pending.id}/messages`, owner.id, message(), 201);
    expect(await prisma.marketplaceRequest.findUniqueOrThrow({ where: { id: pending.id } })).toMatchObject({ status: 'accepted', acceptedAt: expect.any(Date), firstRecipientReplyAt: expect.any(Date) });
    const events = await prisma.marketplaceEvent.findMany({ where: { requestId: { in: [created.id, pending.id] } } });
    for (const event of events) { expect(event.properties).toEqual({}); expect(JSON.stringify(event)).not.toContain(dto.body); expect(JSON.stringify(event)).not.toContain(created.body); }
  });

  it('rechecks stale draft, closed, expired, removed, unavailable and withdrawn-consent listings before submit or accept', async () => {
    const owner = await user(), requester = await user();
    for (const fields of [{ status: 'draft' }, { status: 'paused' }, { removedAt: new Date() }, { publicConsent: false }, { availability: 'unavailable' }]) {
      const listing = await service(owner.id, fields);
      await request('POST', '/marketplace/requests', requester.id, introduction(listing.id), 404);
    }
    for (const fields of [{ status: 'closed' }, { deadline: new Date(Date.now() - 86400000) }]) {
      const brief = await project(owner.id, fields);
      await request('POST', '/marketplace/requests', requester.id, introduction(brief.id, 'project'), 404);
    }
    const listing = await service(owner.id), pending = await submit(requester.id, listing.id);
    await prisma.freelancerProfile.update({ where: { userId: owner.id }, data: { publicPreviewEnabled: false } });
    await state(owner.id, pending.id, 'accept', 403);
    await request('POST', `/marketplace/requests/${pending.id}/messages`, owner.id, message(), 403);
    expect((await request('GET', `/marketplace/requests/${pending.id}`, requester.id)).data.listing).toMatchObject({ available: false, title: 'Listing unavailable' });
  });

  it('rolls first-reply acceptance, message and structural events back together when outbox creation fails', async () => {
    const owner = await user(), requester = await user(), listing = await service(owner.id), created = await submit(requester.id, listing.id), reply = message();
    const failure = jest.spyOn(activity, 'notify').mockRejectedValueOnce(new Error('Synthetic outbox failure'));
    try { await request('POST', `/marketplace/requests/${created.id}/messages`, owner.id, reply, 500); }
    finally { failure.mockRestore(); }
    expect(await prisma.marketplaceRequest.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ status: 'pending', acceptedAt: null, firstRecipientReplyAt: null });
    expect(await prisma.marketplaceMessage.count({ where: { requestId: created.id } })).toBe(0);
    expect(await prisma.marketplaceEvent.count({ where: { requestId: created.id, type: 'marketplace_request_accepted' } })).toBe(0);
    await request('POST', `/marketplace/requests/${created.id}/messages`, owner.id, reply, 201);
    expect(await prisma.marketplaceMessage.count({ where: { requestId: created.id } })).toBe(1);
  });

  it('revokes named company-participant access immediately and prevents contact with inactive participants', async () => {
    const owner = await user(), requester = await user(), company = await prisma.company.create({ data: { name: 'Named company participant' } });
    const seat = await prisma.companyMember.create({ data: { userId: owner.id, companyId: company.id, role: 'OWNER', status: 'ACTIVE' } });
    const listing = await service(owner.id, { companyId: company.id }), pending = await submit(requester.id, listing.id);
    await prisma.companyMember.update({ where: { id: seat.id }, data: { status: 'REMOVED' } });
    await request('GET', `/marketplace/requests/${pending.id}`, owner.id, undefined, 403);
    await request('GET', `/marketplace/requests/${pending.id}/messages`, owner.id, undefined, 403);
    await state(owner.id, pending.id, 'accept', 403);
    expect((await request('GET', '/marketplace/requests', owner.id)).meta.total).toBe(0);
    expect((await request('GET', `/marketplace/requests/${pending.id}`, requester.id)).data.permissions.canSend).toBe(false);
    await prisma.companyMember.update({ where: { id: seat.id }, data: { status: 'ACTIVE' } });
    await state(owner.id, pending.id, 'accept');
    const requesterCompany = await prisma.company.create({ data: { name: 'Requester company context' } });
    const requesterSeat = await prisma.companyMember.create({ data: { companyId: requesterCompany.id, userId: requester.id, role: 'OWNER', status: 'ACTIVE' } });
    const companyRequest = await submit(requester.id, (await service(owner.id)).id, 'service', { companyId: requesterCompany.id });
    await prisma.companyMember.update({ where: { id: requesterSeat.id }, data: { role: 'RECRUITER' } });
    await request('GET', `/marketplace/requests/${companyRequest.id}`, requester.id, undefined, 403);
    await request('GET', `/marketplace/requests/${companyRequest.id}/messages`, requester.id, undefined, 403);
    expect((await request('GET', `/marketplace/requests/${companyRequest.id}`, owner.id)).data.permissions.canSend).toBe(false);
    await prisma.user.update({ where: { id: owner.id }, data: { status: 'SUSPENDED' } });
    await request('GET', `/marketplace/requests/${pending.id}`, owner.id, undefined, 401);
    await request('POST', `/marketplace/requests/${pending.id}/messages`, requester.id, message(), 403);
    await prisma.user.update({ where: { id: requester.id }, data: { status: 'INACTIVE' } });
    await request('GET', `/marketplace/requests/${pending.id}`, requester.id, undefined, 403);
  });

  it('keeps accepted history after ordinary listing closure while removal stops new messages', async () => {
    const owner = await user(), requester = await user(), brief = await project(owner.id), created = await submit(requester.id, brief.id, 'project');
    await state(owner.id, created.id, 'accept');
    await prisma.projectBrief.update({ where: { id: brief.id }, data: { status: 'closed' } });
    expect((await request('GET', `/marketplace/requests/${created.id}`, requester.id)).data).toMatchObject({ status: 'accepted', listing: { available: false }, permissions: { canSend: true } });
    await request('POST', `/marketplace/requests/${created.id}/messages`, requester.id, message(), 201);
    await prisma.projectBrief.update({ where: { id: brief.id }, data: { removedAt: new Date() } });
    await request('POST', `/marketplace/requests/${created.id}/messages`, requester.id, message(), 403);
    expect((await request('GET', `/marketplace/requests/${created.id}/messages`, requester.id)).meta.total).toBe(1);
  });

  it('makes decline and withdrawal terminal and applies blocks across future listings', async () => {
    const owner = await user(), requester = await user();
    const declined = await submit(requester.id, (await service(owner.id)).id);
    await state(owner.id, declined.id, 'decline'); await state(owner.id, declined.id, 'accept', 409);
    await request('POST', `/marketplace/requests/${declined.id}/messages`, requester.id, message(), 409);
    const withdrawn = await submit(requester.id, (await service(owner.id)).id);
    await state(requester.id, withdrawn.id, 'withdraw'); await state(owner.id, withdrawn.id, 'accept', 409);
    const blocked = await submit(requester.id, (await service(owner.id)).id);
    await state(owner.id, blocked.id, 'block'); await state(owner.id, blocked.id, 'block');
    expect(await prisma.marketplaceBlock.count({ where: { blockerId: owner.id, blockedId: requester.id } })).toBe(1);
    await request('POST', `/marketplace/requests/${blocked.id}/messages`, requester.id, message(), 403);
    await request('POST', '/marketplace/requests', requester.id, introduction((await service(owner.id)).id), 403);
    await request('POST', '/marketplace/requests', owner.id, introduction((await service(requester.id)).id), 403);
  });

  it('retains history, read, decline, withdrawal, block and report under the disabled flag while preventing new contact', async () => {
    const owner = await user(), requester = await user();
    const pending = await submit(requester.id, (await service(owner.id)).id), withdrawable = await submit(requester.id, (await service(owner.id)).id), accepted = await submit(requester.id, (await service(owner.id)).id);
    await state(owner.id, accepted.id, 'accept');
    process.env.MARKETPLACE_ENQUIRIES_ENABLED = 'TRUE';
    await request('POST', '/marketplace/requests', requester.id, introduction((await service(owner.id)).id), 403);
    await state(owner.id, pending.id, 'accept', 403);
    await request('POST', `/marketplace/requests/${accepted.id}/messages`, requester.id, message(), 403);
    await request('GET', `/marketplace/requests/${accepted.id}`, requester.id);
    await request('POST', `/marketplace/requests/${accepted.id}/read`, requester.id, {}, 201);
    await state(owner.id, pending.id, 'decline'); await state(requester.id, withdrawable.id, 'withdraw'); await state(owner.id, accepted.id, 'block');
    const report = { reason: 'spam', details: 'Please review this privately submitted concern.' };
    await request('POST', `/marketplace/requests/${accepted.id}/report`, requester.id, report, 201);
    await request('POST', `/marketplace/requests/${accepted.id}/report`, requester.id, report, 201);
    expect(await prisma.marketplaceRequestReport.count({ where: { requestId: accepted.id, reporterId: requester.id } })).toBe(1);
  });

  it('paginates inboxes and messages, tracks unread content and bounds user input', async () => {
    const owner = await user(), requester = await user(), created = await submit(requester.id, (await service(owner.id)).id);
    const second = await submit(requester.id, (await service(owner.id)).id);
    const inbox = await request('GET', '/marketplace/requests?box=incoming&page=1&limit=1', owner.id);
    expect(inbox.meta).toMatchObject({ total: 2, totalPages: 2 }); expect(inbox.data).toHaveLength(1);
    await request('POST', `/marketplace/requests/${created.id}/read`, owner.id, {}, 201);
    expect((await request('GET', `/marketplace/requests/${created.id}`, owner.id)).data.unreadCount).toBe(0);
    await request('POST', `/marketplace/requests/${created.id}/messages`, owner.id, message('The first reply.'), 201);
    await request('POST', `/marketplace/requests/${created.id}/messages`, owner.id, message('The second reply.'), 201);
    expect((await request('GET', `/marketplace/requests/${created.id}`, requester.id)).data.unreadCount).toBe(2);
    const messages = await request('GET', `/marketplace/requests/${created.id}/messages?page=1&limit=1`, requester.id);
    expect(messages.meta).toMatchObject({ total: 2, totalPages: 2 }); expect(messages.data[0].body).toBe('The second reply.');
    await request('POST', `/marketplace/requests/${created.id}/read`, requester.id, {}, 201);
    expect((await request('GET', `/marketplace/requests/${created.id}`, requester.id)).data.unreadCount).toBe(0);
    for (const path of ['/marketplace/requests?limit=51', '/marketplace/requests?page=-1', `/marketplace/requests/${created.id}/messages?limit=51`]) await request('GET', path, requester.id, undefined, 400);
    for (const fields of [{ body: '   ' }, { body: 'x'.repeat(5001) }, { workSamples: [{ label: 'Unsafe link', url: 'http://example.test/work' }] }, { workSamples: [{ label: 'Credentials', url: 'https://user:password@example.test/work' }] }]) await request('POST', '/marketplace/requests', requester.id, introduction((await service(owner.id)).id, 'service', fields), 400);
    expect(second.id).not.toBe(created.id);
  });

  it('enforces persisted request and message rate limits without counting identical retries twice', async () => {
    const owner = await user(), requester = await user();
    const firstListing = await service(owner.id);
    const listings = [firstListing, ...await Promise.all(Array.from({ length: 10 }, () => service(owner.id)))];
    for (const listing of listings.slice(0, 10)) await submit(requester.id, listing.id);
    await request('POST', '/marketplace/requests', requester.id, introduction(listings[10].id), 429);
    const existing = await prisma.marketplaceRequest.findFirstOrThrow({ where: { requesterId: requester.id } });
    await state(owner.id, existing.id, 'accept');
    await prisma.marketplaceMessage.createMany({ data: Array.from({ length: 60 }, (_, index) => ({ requestId: existing.id, senderId: requester.id, body: `Previously sent message ${index}`, idempotencyKey: randomUUID(), payloadHash: `fixture-${index}` })) });
    await request('POST', `/marketplace/requests/${existing.id}/messages`, requester.id, message(), 429);
    expect(await prisma.marketplaceMessage.count({ where: { requestId: existing.id } })).toBe(60);
  });

  it('delivers the durable outbox after a transient database failure without duplicating business records or private notification content', async () => {
    // Drain earlier synthetic activity, then inject a failure only for this recipient.
    for (let attempt = 0; attempt < 4; attempt++) { if (!(await activity.deliverPending()).examined) break; }
    const owner = await user(), requester = await user(), listing = await service(owner.id), created = await submit(requester.id, listing.id);
    const delivery = await prisma.marketplaceDelivery.findFirstOrThrow({ where: { requestId: created.id } });
    const [{ schema }] = await prisma.$queryRaw<Array<{ schema: string }>>`SELECT current_schema() AS schema`;
    if (!/^coral_e2e_[a-f0-9]{32}$/.test(schema)) throw new Error('Refusing failure injection outside the owned schema');
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${schema}".fixture_notification_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic delivery unavailable'; END; $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER fixture_notification_failure BEFORE INSERT ON "${schema}".notifications FOR EACH ROW WHEN (NEW.user_id = '${owner.id}') EXECUTE FUNCTION "${schema}".fixture_notification_failure()`);
    try {
      expect((await activity.deliverPending()).failed).toBe(1);
      expect(await prisma.marketplaceDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).toMatchObject({ status: 'pending', attempts: 1, lastError: 'delivery_failed' });
      expect(await prisma.notification.findUnique({ where: { id: delivery.notificationId } })).toBeNull();
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER fixture_notification_failure ON "${schema}".notifications`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION "${schema}".fixture_notification_failure()`);
    }
    await prisma.marketplaceDelivery.update({ where: { id: delivery.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
    await Promise.all([activity.deliverPending(), activity.deliverPending()]);
    expect(await prisma.notification.count({ where: { id: delivery.notificationId } })).toBe(1);
    const notification = await prisma.notification.findUniqueOrThrow({ where: { id: delivery.notificationId } });
    expect(notification).toMatchObject({ userId: owner.id, type: 'marketplace', link: `/marketplace/inbox?request=${created.id}` });
    expect(JSON.stringify(notification)).not.toContain(created.body); expect(JSON.stringify(notification)).not.toContain(listing.title);
    expect(await prisma.marketplaceDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).toMatchObject({ status: 'delivered', attempts: 2 });
    expect(await prisma.marketplaceRequest.count({ where: { id: created.id } })).toBe(1);
  });

  it('deduplicates structural listing views and restricts aggregate metrics and report fields without opening private threads to admins', async () => {
    const owner = await user(), requester = await user(), admin = await user('ADMIN'), listing = await service(owner.id);
    const view = { kind: 'service', listingId: listing.id, sessionId: randomUUID(), source: 'directory' };
    await Promise.all([request('POST', '/marketplace/events/listing-view', null, view, 201), request('POST', '/marketplace/events/listing-view', null, view, 201)]);
    expect(await prisma.marketplaceEvent.count({ where: { type: 'listing_view', entityId: listing.id } })).toBe(1);
    const created = await submit(requester.id, listing.id), concern = { reason: 'fraud', details: 'Review this concern without exposing its entire private thread.' };
    await request('POST', `/marketplace/requests/${created.id}/report`, requester.id, concern, 201);
    await request('GET', '/marketplace/metrics', requester.id, undefined, 403);
    await request('GET', '/marketplace/moderation/request-reports', requester.id, undefined, 403);
    const metrics = (await request('GET', '/marketplace/metrics', admin.id)).data;
    expect(metrics.events).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'listing_view', source: 'directory', count: expect.any(Number) })]));
    expect(JSON.stringify(metrics)).not.toContain(created.id); expect(JSON.stringify(metrics)).not.toContain(created.body);
    const report = (await request('GET', '/marketplace/moderation/request-reports', admin.id)).data.find((row: any) => row.details === concern.details);
    expect(report).toMatchObject(concern);
    for (const field of ['requestId', 'request', 'reporterId', 'body', 'messages']) expect(report).not.toHaveProperty(field);
    await request('POST', `/marketplace/moderation/request-reports/${report.id}/review`, admin.id, {}, 201);
    await request('POST', `/marketplace/requests/${created.id}/report`, requester.id, concern, 201);
    expect(await prisma.marketplaceRequestReport.findUniqueOrThrow({ where: { id: report.id } })).toMatchObject({ status: 'reviewed' });
    await request('POST', `/marketplace/requests/${created.id}/report`, requester.id, { ...concern, reason: 'spam' }, 201);
    expect(await prisma.marketplaceRequestReport.findUniqueOrThrow({ where: { id: report.id } })).toMatchObject({ status: 'open', reviewedAt: null });
    await request('GET', `/marketplace/requests/${created.id}`, admin.id, undefined, 404);
  });

  it('cancels undelivered notifications after a participant blocks the pair', async () => {
    const owner = await user(), requester = await user(), created = await submit(requester.id, (await service(owner.id)).id);
    const delivery = await prisma.marketplaceDelivery.findFirstOrThrow({ where: { requestId: created.id } });
    await state(owner.id, created.id, 'block');
    await activity.deliverPending();
    expect(await prisma.marketplaceDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).toMatchObject({ status: 'cancelled' });
    expect(await prisma.notification.findUnique({ where: { id: delivery.notificationId } })).toBeNull();
  });

  it('filters discovery by exact case-insensitive country/city and service availability with accurate totals', async () => {
    const owner = await user(), marker = randomUUID();
    const visible = await service(owner.id, { title: `Geography ${marker}`, country: 'Canada', city: 'Toronto', availability: 'available' });
    await service(owner.id, { title: `Geography ${marker}`, country: 'Canada', city: 'Toronto', availability: 'limited' });
    await service(owner.id, { title: `Geography ${marker}`, country: 'Canada', city: 'Ottawa', availability: 'available' });
    const result = await request('GET', `/services?q=${marker}&country=canada&city=TORONTO&availability=available&limit=1`);
    expect(result.meta).toMatchObject({ total: 1, totalPages: 1 }); expect(result.data.map((row: any) => row.id)).toEqual([visible.id]);
    expect((await request('GET', `/services?q=${marker}&city=Tor`)).meta.total).toBe(0);
    await request('GET', '/services?availability=unknown', null, undefined, 400);
    await request('GET', '/gigs?availability=available', null, undefined, 400);
  });

  it('accepts canonical community attribution and rejects mismatched, removed and revoked-company source posts', async () => {
    const owner = await user(), requester = await user(), listing = await service(owner.id);
    const post = await prisma.post.create({ data: { authorId: owner.id, purpose: 'SERVICE_ANNOUNCEMENT', postType: 'TEXT', linkedServiceListingId: listing.id, content: 'A canonical public service announcement', mediaUrls: [], hashtags: [] } });
    const created = await submit(requester.id, listing.id, 'service', { source: 'community', postId: post.id });
    expect(await prisma.marketplaceRequest.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ source: 'community', postId: post.id });
    expect(await prisma.marketplaceEvent.findFirstOrThrow({ where: { requestId: created.id } })).toMatchObject({ source: 'community', postId: post.id });
    await request('POST', '/marketplace/events/listing-view', null, { kind: 'service', listingId: listing.id, source: 'community', postId: post.id, sessionId: randomUUID() }, 201);
    const otherListing = await service(owner.id);
    await request('POST', '/marketplace/requests', requester.id, introduction(otherListing.id, 'service', { source: 'community', postId: post.id }), 400);
    await request('POST', '/marketplace/events/listing-view', null, { kind: 'service', listingId: otherListing.id, source: 'community', postId: post.id, sessionId: randomUUID() }, 400);
    await prisma.post.update({ where: { id: post.id }, data: { removedAt: new Date() } });
    await request('POST', '/marketplace/requests', (await user()).id, introduction(listing.id, 'service', { source: 'community', postId: post.id }), 400);
    await request('POST', '/marketplace/events/listing-view', null, { kind: 'service', listingId: listing.id, source: 'community', postId: post.id, sessionId: randomUUID() }, 400);
    const company = await prisma.company.create({ data: { name: 'Community source company' } }), announcer = await user();
    await prisma.companyMember.create({ data: { companyId: company.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' } });
    const seat = await prisma.companyMember.create({ data: { companyId: company.id, userId: announcer.id, role: 'ADMIN', status: 'ACTIVE' } });
    const companyListing = await service(owner.id, { companyId: company.id });
    const companyPost = await prisma.post.create({ data: { authorId: announcer.id, companyId: company.id, purpose: 'SERVICE_ANNOUNCEMENT', postType: 'TEXT', linkedServiceListingId: companyListing.id, content: 'An authorized company service announcement', mediaUrls: [], hashtags: [] } });
    await prisma.companyMember.update({ where: { id: seat.id }, data: { status: 'REMOVED' } });
    await request('POST', '/marketplace/requests', requester.id, introduction(companyListing.id, 'service', { source: 'community', postId: companyPost.id }), 400);
    await request('POST', '/marketplace/events/listing-view', null, { kind: 'service', listingId: companyListing.id, source: 'community', postId: companyPost.id, sessionId: randomUUID() }, 400);
  });
});
