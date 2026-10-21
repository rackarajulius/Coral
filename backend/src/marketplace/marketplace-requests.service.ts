import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WRITE_TRANSACTION } from '../common/database-transaction';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceActivityService } from './marketplace-activity.service';
import { ListingKind, safeWorkUrl } from './marketplace-policy';
import { CreateMarketplaceRequestDto, MarketplaceMessageDto, MarketplaceMessageQueryDto, MarketplaceRequestQueryDto, MarketplaceRequestReportDto, REQUEST_REPORT_REASONS } from './dto/marketplace-requests.dto';

type Database = Prisma.TransactionClient | PrismaService;
const PERSON = { id: true, displayName: true, firstName: true, lastName: true, status: true } satisfies Prisma.UserSelect;
const COMPANY = { id: true, name: true } satisfies Prisma.CompanySelect;
const REQUEST_INCLUDE = { requester: { select: PERSON }, recipient: { select: PERSON }, requesterCompany: { select: COMPANY }, recipientCompany: { select: COMPANY } } satisfies Prisma.MarketplaceRequestInclude;
type RequestRecord = Prisma.MarketplaceRequestGetPayload<{ include: typeof REQUEST_INCLUDE }>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class MarketplaceRequestsService {
  constructor(private readonly prisma: PrismaService, private readonly marketplace: MarketplaceService, private readonly activity: MarketplaceActivityService) {}
  enquiriesEnabled() { return process.env.MARKETPLACE_ENQUIRIES_ENABLED === 'true'; }
  private requireEnabled() { if (!this.enquiriesEnabled()) throw new ForbiddenException('Marketplace enquiries are not enabled yet. Existing requests remain available.'); }
  private hash(payload: unknown) { return createHash('sha256').update(JSON.stringify(payload)).digest('hex'); }
  private entityType(kind: string) { return kind === 'service' ? 'service_listing' : 'project_brief'; }
  private assertUuid(value: string) { if (typeof value !== 'string' || !UUID.test(value)) throw new BadRequestException('Invalid record identifier'); }
  private body(value: unknown, min: number) {
    if (typeof value !== 'string' || value.length > 5000 || value.trim().length < min) throw new BadRequestException(`Enter ${min} to 5000 characters`);
    return value.trim();
  }
  private samples(value: unknown) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 5) throw new BadRequestException('Add up to five work samples');
    return value.map(sample => {
      if (!sample || typeof sample !== 'object' || Object.keys(sample).some(k => !['label', 'url'].includes(k)) || typeof sample.label !== 'string' || sample.label.length > 100 || !sample.label.trim() || !safeWorkUrl(sample.url)) throw new BadRequestException('Work samples require a label and a credential-free HTTPS URL');
      return { label: sample.label.trim(), url: safeWorkUrl(sample.url)! };
    });
  }
  private async active(database: Database, userId: string) {
    const account = await database.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
    if (!account || account.status !== 'ACTIVE') throw new ForbiddenException('An active account is required');
  }
  private async companyAllowed(database: Database, companyId: string | null, userId: string) {
    if (!companyId) return true;
    const seat = await database.companyMember.findUnique({ where: { companyId_userId: { companyId, userId } }, select: { status: true, role: true } });
    return !!seat && seat.status === 'ACTIVE' && ['OWNER', 'ADMIN'].includes(seat.role);
  }
  private async assertCompany(database: Database, companyId: string | null, userId: string) {
    if (!await this.companyAllowed(database, companyId, userId)) throw new ForbiddenException('Your company publishing permission is no longer active');
  }
  private async blocked(database: Database, a: string, b: string) {
    return !!await database.marketplaceBlock.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { id: true } });
  }
  private async lockActors(tx: Prisma.TransactionClient, ids: string[]) {
    // A stable order also serializes rate limits and pair-wide blocks across
    // requests on different listings.
    for (const id of [...new Set(ids)].sort()) await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${id} FOR UPDATE`);
  }
  private async lockCompany(tx: Prisma.TransactionClient, companyId: string | null, userId: string) {
    if (companyId) await tx.$queryRaw(Prisma.sql`SELECT id FROM company_members WHERE company_id = ${companyId} AND user_id = ${userId} FOR UPDATE`);
  }
  private async lockListing(tx: Prisma.TransactionClient, kind: ListingKind, id: string) {
    const table = Prisma.raw(kind === 'service' ? 'service_listings' : 'project_briefs');
    await tx.$queryRaw(Prisma.sql`SELECT id FROM ${table} WHERE id = ${id} FOR UPDATE`);
  }
  private async lockProvider(tx: Prisma.TransactionClient, kind: ListingKind, userId: string) {
    if (kind === 'service') await tx.$queryRaw(Prisma.sql`SELECT id FROM freelancer_profiles WHERE user_id = ${userId} FOR SHARE`);
  }
  private async listing(database: Database, kind: ListingKind, id: string) {
    return kind === 'service' ? database.serviceListing.findUnique({ where: { id }, select: { id: true, ownerUserId: true, companyId: true, removedAt: true, availability: true } })
      : database.projectBrief.findUnique({ where: { id }, select: { id: true, ownerUserId: true, companyId: true, removedAt: true } });
  }
  private listingId(record: RequestRecord) { return record.serviceListingId ?? record.projectBriefId!; }
  private async publicListing(database: Database, kind: ListingKind, id: string) {
    try { return await this.marketplace.getPublic(kind, id, database); }
    catch (error) { if (error instanceof NotFoundException) return null; throw error; }
  }
  private async contactAvailable(database: Database, kind: ListingKind, id: string) {
    const record = await this.publicListing(database, kind, id);
    return !!record && (kind !== 'service' || record.availability !== 'unavailable');
  }
  async capabilities(kind: ListingKind, listingId: string, userId?: string) {
    if (!['service', 'project'].includes(kind)) throw new BadRequestException('Invalid listing kind'); this.assertUuid(listingId);
    const base = { enquiriesEnabled: this.enquiriesEnabled(), canSubmit: false };
    // Do not disclose owners or request existence for private listing targets.
    if (!await this.contactAvailable(this.prisma, kind, listingId)) return { ...base, reason: 'listing_unavailable' };
    if (!userId) return { ...base, reason: 'sign_in_required' };
    const account = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (account?.status !== 'ACTIVE') return { ...base, reason: 'account_inactive' };
    const target = await this.listing(this.prisma, kind, listingId);
    if (!target) return { ...base, reason: 'listing_unavailable' };
    const existing = await this.prisma.marketplaceRequest.findFirst({ where: { requesterId: userId, ...(kind === 'service' ? { serviceListingId: listingId } : { projectBriefId: listingId }) }, include: REQUEST_INCLUDE });
    if (existing) return { ...base, reason: 'existing_request', ...(await this.companyAllowed(this.prisma, existing.requesterCompanyId, userId) ? { existingRequestId: existing.id } : {}) };
    if (target.ownerUserId === userId) return { ...base, reason: 'own_listing' };
    if (target.companyId && await this.prisma.companyMember.findFirst({ where: { companyId: target.companyId, userId, status: 'ACTIVE' }, select: { id: true } })) return { ...base, reason: 'company_member' };
    if (await this.blocked(this.prisma, userId, target.ownerUserId)) return { ...base, reason: 'blocked' };
    return this.enquiriesEnabled() ? { ...base, canSubmit: true } : { ...base, reason: 'disabled' };
  }
  private async find(database: Database, id: string) { return database.marketplaceRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE }); }
  private async participant(database: Database, userId: string, id: string) {
    const record = await this.find(database, id);
    if (!record || ![record.requesterId, record.recipientId].includes(userId)) throw new NotFoundException('Request not available');
    await this.active(database, userId);
    await this.assertCompany(database, userId === record.requesterId ? record.requesterCompanyId : record.recipientCompanyId, userId);
    return record;
  }
  private async lockRequest(tx: Prisma.TransactionClient, userId: string, id: string) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM marketplace_requests WHERE id = ${id} FOR UPDATE`);
    let record = await this.participant(tx, userId, id);
    await this.lockListing(tx, record.kind as ListingKind, this.listingId(record));
    await this.lockActors(tx, [record.requesterId, record.recipientId]);
    for (const [companyId, participantId] of [[record.requesterCompanyId, record.requesterId], [record.recipientCompanyId, record.recipientId]].sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`))) await this.lockCompany(tx, companyId, participantId!);
    record = await this.participant(tx, userId, id);
    await this.lockProvider(tx, record.kind as ListingKind, record.recipientId);
    return record;
  }
  private async communicable(database: Database, record: RequestRecord) {
    if (record.requester.status !== 'ACTIVE' || record.recipient.status !== 'ACTIVE'
      || !await this.companyAllowed(database, record.requesterCompanyId, record.requesterId)
      || !await this.companyAllowed(database, record.recipientCompanyId, record.recipientId)
      || await this.blocked(database, record.requesterId, record.recipientId)) return false;
    const target = await this.listing(database, record.kind as ListingKind, this.listingId(record));
    return !!target && !target.removedAt;
  }
  private async serialize(database: Database, record: RequestRecord, userId: string, detail: boolean) {
    const kind = record.kind as ListingKind, requester = userId === record.requesterId;
    const canonical = await this.publicListing(database, kind, this.listingId(record));
    const communication = await this.communicable(database, record);
    const pendingEligible = record.status === 'pending' && await this.contactAvailable(database, kind, this.listingId(record));
    const open = ['pending', 'accepted'].includes(record.status);
    const readAt = requester ? record.requesterLastReadAt : record.recipientLastReadAt;
    const unreadMessages = await database.marketplaceMessage.count({ where: { requestId: record.id, senderId: { not: userId }, ...(readAt ? { createdAt: { gt: readAt } } : {}) } });
    const initialUnread = !requester && (!readAt || readAt < record.createdAt) ? 1 : 0;
    const person = (value: RequestRecord['requester']) => ({ id: value.id, displayName: value.displayName?.trim() || [value.firstName, value.lastName].filter(Boolean).join(' ') || 'Coral member' });
    return {
      id: record.id, kind, status: record.status, createdAt: record.createdAt, updatedAt: record.updatedAt,
      acceptedAt: record.acceptedAt, firstRecipientReplyAt: record.firstRecipientReplyAt,
      requester: person(record.requester), recipient: person(record.recipient), requesterCompany: record.requesterCompany, recipientCompany: record.recipientCompany,
      listing: { kind, id: this.listingId(record), title: canonical?.title ?? 'Listing unavailable', url: kind === 'service' ? `/services/${this.listingId(record)}` : `/projects/${this.listingId(record)}`, available: !!canonical },
      viewerSide: requester ? 'requester' : 'recipient', unreadCount: unreadMessages + initialUnread,
      permissions: {
        canAccept: !requester && pendingEligible && communication && this.enquiriesEnabled(),
        canDecline: !requester && record.status === 'pending', canWithdraw: requester && open,
        canBlock: record.status !== 'blocked', canReport: true,
        canSend: communication && this.enquiriesEnabled() && (record.status === 'accepted' || (!requester && pendingEligible)),
      }, ...(detail ? { body: record.body, workSamples: record.workSamples } : {}),
    };
  }
  private async validateSource(tx: Prisma.TransactionClient, kind: ListingKind, listingId: string, source: string, postId?: string) {
    if (source !== 'community') { if (postId) throw new BadRequestException('Only community requests may include a post reference'); return; }
    if (!postId) throw new BadRequestException('Community requests require the linked post');
    await tx.$queryRaw(Prisma.sql`SELECT id FROM posts WHERE id = ${postId} FOR SHARE`);
    const post = await tx.post.findUnique({ where: { id: postId }, select: { authorId: true, companyId: true, removedAt: true, purpose: true, linkedServiceListingId: true, linkedGigId: true, author: { select: { status: true } } } });
    if (!post || post.removedAt || post.author.status !== 'ACTIVE' || !await this.companyAllowed(tx, post.companyId, post.authorId)
      || (kind === 'service' ? post.linkedServiceListingId !== listingId || !['SERVICE_ANNOUNCEMENT', 'SHOWCASE'].includes(post.purpose) : post.linkedGigId !== listingId || post.purpose !== 'OPPORTUNITY')) throw new BadRequestException('The community post does not link to this public listing');
  }
  async create(userId: string, dto: CreateMarketplaceRequestDto) {
    this.assertUuid(dto.listingId); this.assertUuid(dto.idempotencyKey); if (dto.companyId) this.assertUuid(dto.companyId); if (dto.postId) this.assertUuid(dto.postId);
    if (!['service', 'project'].includes(dto.kind)) throw new BadRequestException('Invalid listing kind');
    const body = this.body(dto.body, 20), workSamples = this.samples(dto.workSamples), source = dto.source ?? 'direct', companyId = dto.companyId ?? null;
    if (!['direct', 'community', 'directory', 'profile'].includes(source)) throw new BadRequestException('Invalid request source');
    const payloadHash = this.hash({ kind: dto.kind, listingId: dto.listingId, body, workSamples, companyId, source, postId: dto.postId ?? null });
    return this.prisma.$transaction(async tx => {
      await this.lockListing(tx, dto.kind, dto.listingId);
      const target = await this.listing(tx, dto.kind, dto.listingId);
      await this.lockActors(tx, [userId, ...(target ? [target.ownerUserId] : [])]);
      const seats: Array<[string | null, string]> = [[companyId, userId], ...(target ? [[target.companyId, target.ownerUserId], [target.companyId, userId]] as Array<[string | null, string]> : [])];
      for (const [seatCompany, seatUser] of seats.sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`))) await this.lockCompany(tx, seatCompany, seatUser);
      if (target) await this.lockProvider(tx, dto.kind, target.ownerUserId);
      await this.active(tx, userId); await this.assertCompany(tx, companyId, userId);
      const retry = await tx.marketplaceRequest.findUnique({ where: { requesterId_idempotencyKey: { requesterId: userId, idempotencyKey: dto.idempotencyKey } }, include: REQUEST_INCLUDE });
      if (retry) { if (retry.payloadHash !== payloadHash) throw new ConflictException('This request key was already used for different content'); await this.participant(tx, userId, retry.id); return this.serialize(tx, retry, userId, true); }
      this.requireEnabled();
      if (!target || !await this.contactAvailable(tx, dto.kind, dto.listingId)) throw new NotFoundException('Listing not available for contact');
      if (target.ownerUserId === userId) throw new ForbiddenException('You cannot contact your own listing');
      if (target.companyId && await tx.companyMember.findFirst({ where: { companyId: target.companyId, userId, status: 'ACTIVE' }, select: { id: true } })) throw new ForbiddenException('Company members cannot submit to their own company listing');
      if (await this.blocked(tx, userId, target.ownerUserId)) throw new ForbiddenException('Contact is unavailable between these members');
      const existing = await tx.marketplaceRequest.findFirst({ where: { requesterId: userId, ...(dto.kind === 'service' ? { serviceListingId: dto.listingId } : { projectBriefId: dto.listingId }) }, select: { id: true } });
      if (existing) throw new ConflictException('You already have a request for this listing');
      const count = await tx.marketplaceRequest.count({ where: { requesterId: userId, createdAt: { gte: new Date(Date.now() - 3600000) } } });
      if (count >= 10) throw new HttpException('You can submit up to ten new requests per hour', 429);
      await this.validateSource(tx, dto.kind, dto.listingId, source, dto.postId);
      const record = await tx.marketplaceRequest.create({ data: { kind: dto.kind, requesterId: userId, recipientId: target.ownerUserId, requesterCompanyId: companyId, recipientCompanyId: target.companyId, ...(dto.kind === 'service' ? { serviceListingId: dto.listingId } : { projectBriefId: dto.listingId }), body, workSamples, source, postId: dto.postId ?? null, idempotencyKey: dto.idempotencyKey, payloadHash, requesterLastReadAt: new Date() }, include: REQUEST_INCLUDE });
      const eventId = await this.activity.record(tx, { type: dto.kind === 'service' ? 'service_enquiry_submitted' : 'project_response_submitted', entityType: this.entityType(dto.kind), entityId: dto.listingId, actorId: userId, companyId: target.companyId ?? undefined, requestId: record.id, source, postId: dto.postId, dedupeKey: `request:${record.id}:submitted` });
      await this.activity.notify(tx, eventId, record.id, record.recipientId);
      return this.serialize(tx, record, userId, true);
    }, WRITE_TRANSACTION);
  }
  async get(userId: string, id: string) { this.assertUuid(id); return this.serialize(this.prisma, await this.participant(this.prisma, userId, id), userId, true); }
  private query(query: { page?: number; limit?: number }) {
    const page = query.page ?? 1, limit = query.limit ?? 20;
    if (!Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(limit) || limit < 1 || limit > 50) throw new BadRequestException('Invalid pagination');
    return { page, limit };
  }
  async list(userId: string, query: MarketplaceRequestQueryDto) {
    await this.active(this.prisma, userId); const { page, limit } = this.query(query), box = query.box ?? 'incoming';
    if (!['incoming', 'outgoing'].includes(box)) throw new BadRequestException('Invalid request box');
    const companies = await this.prisma.companyMember.findMany({ where: { userId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } }, select: { companyId: true } });
    const companyFilter = { OR: [{ [box === 'incoming' ? 'recipientCompanyId' : 'requesterCompanyId']: null }, { [box === 'incoming' ? 'recipientCompanyId' : 'requesterCompanyId']: { in: companies.map(c => c.companyId) } }] };
    const where = { [box === 'incoming' ? 'recipientId' : 'requesterId']: userId, ...companyFilter };
    const [total, records] = await this.prisma.$transaction([this.prisma.marketplaceRequest.count({ where }), this.prisma.marketplaceRequest.findMany({ where, include: REQUEST_INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit })]);
    return { data: await Promise.all(records.map(record => this.serialize(this.prisma, record, userId, false))), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  private async accepted(tx: Prisma.TransactionClient, record: RequestRecord, actorId: string, notify: boolean) {
    const updated = await tx.marketplaceRequest.update({ where: { id: record.id }, data: { status: 'accepted', acceptedAt: new Date() }, include: REQUEST_INCLUDE });
    const eventId = await this.activity.record(tx, { type: 'marketplace_request_accepted', entityType: this.entityType(record.kind), entityId: this.listingId(record), actorId, companyId: record.recipientCompanyId ?? undefined, requestId: record.id, source: record.source, postId: record.postId ?? undefined, dedupeKey: `request:${record.id}:accepted` });
    if (notify) await this.activity.notify(tx, eventId, record.id, record.requesterId);
    return updated;
  }
  async transition(userId: string, id: string, action: string) {
    this.assertUuid(id); if (!['accept', 'decline', 'withdraw', 'block'].includes(action)) throw new BadRequestException('Invalid request action');
    return this.prisma.$transaction(async tx => {
      const record = await this.lockRequest(tx, userId, id), requester = userId === record.requesterId;
      if (action === 'accept') {
        if (requester) throw new ForbiddenException('Only the recipient can accept');
        if (record.status === 'accepted') return this.serialize(tx, record, userId, true);
        if (record.status !== 'pending') throw new ConflictException('This request is no longer pending');
        this.requireEnabled();
        if (!await this.communicable(tx, record) || !await this.contactAvailable(tx, record.kind as ListingKind, this.listingId(record))) throw new ForbiddenException('This request is no longer available for acceptance');
        return this.serialize(tx, await this.accepted(tx, record, userId, true), userId, true);
      }
      const next = action === 'decline' ? 'declined' : action === 'withdraw' ? 'withdrawn' : 'blocked';
      if ((action === 'decline' && requester) || (action === 'withdraw' && !requester)) throw new ForbiddenException('That action is unavailable to this participant');
      if (record.status === next) return this.serialize(tx, record, userId, true);
      if (action !== 'block' && (action === 'decline' ? record.status !== 'pending' : !['pending', 'accepted'].includes(record.status))) throw new ConflictException('This request cannot change to that state');
      if (action === 'block') await tx.marketplaceBlock.upsert({ where: { blockerId_blockedId: { blockerId: userId, blockedId: requester ? record.recipientId : record.requesterId } }, create: { blockerId: userId, blockedId: requester ? record.recipientId : record.requesterId }, update: {} });
      const updated = await tx.marketplaceRequest.update({ where: { id }, data: { status: next }, include: REQUEST_INCLUDE });
      const eventId = await this.activity.record(tx, { type: `marketplace_request_${next}`, entityType: this.entityType(record.kind), entityId: this.listingId(record), actorId: userId, requestId: id, source: record.source, dedupeKey: `request:${id}:${next}` });
      if (action !== 'block') await this.activity.notify(tx, eventId, id, requester ? record.recipientId : record.requesterId);
      return this.serialize(tx, updated, userId, true);
    }, WRITE_TRANSACTION);
  }
  private message(value: { id: string; requestId: string; senderId: string; body: string; createdAt: Date }) { return { id: value.id, requestId: value.requestId, senderId: value.senderId, body: value.body, createdAt: value.createdAt }; }
  async send(userId: string, id: string, dto: MarketplaceMessageDto) {
    this.assertUuid(id); this.assertUuid(dto.idempotencyKey); const body = this.body(dto.body, 1), payloadHash = this.hash({ requestId: id, body });
    return this.prisma.$transaction(async tx => {
      let record = await this.lockRequest(tx, userId, id);
      const retry = await tx.marketplaceMessage.findUnique({ where: { senderId_idempotencyKey: { senderId: userId, idempotencyKey: dto.idempotencyKey } } });
      if (retry) { if (retry.payloadHash !== payloadHash) throw new ConflictException('This message key was already used for different content'); return this.message(retry); }
      this.requireEnabled();
      if (!await this.communicable(tx, record)) throw new ForbiddenException('Messaging is unavailable for this conversation');
      if (record.status === 'pending') {
        if (userId !== record.recipientId) throw new ForbiddenException('Wait for the recipient to accept before messaging');
        if (!await this.contactAvailable(tx, record.kind as ListingKind, this.listingId(record))) throw new ForbiddenException('This listing is no longer available for a first reply');
      } else if (record.status !== 'accepted') throw new ConflictException('This conversation is closed');
      const count = await tx.marketplaceMessage.count({ where: { senderId: userId, createdAt: { gte: new Date(Date.now() - 600000) } } });
      if (count >= 60) throw new HttpException('You can send up to sixty messages every ten minutes', 429);
      if (record.status === 'pending') record = await this.accepted(tx, record, userId, false);
      const sent = await tx.marketplaceMessage.create({ data: { requestId: id, senderId: userId, body, idempotencyKey: dto.idempotencyKey, payloadHash } });
      const firstRecipientReply = userId === record.recipientId && !record.firstRecipientReplyAt;
      await tx.marketplaceRequest.update({ where: { id }, data: { ...(firstRecipientReply ? { firstRecipientReplyAt: sent.createdAt } : {}), [userId === record.requesterId ? 'requesterLastReadAt' : 'recipientLastReadAt']: sent.createdAt } });
      if (firstRecipientReply) await this.activity.record(tx, { type: 'marketplace_recipient_replied', entityType: this.entityType(record.kind), entityId: this.listingId(record), actorId: userId, companyId: record.recipientCompanyId ?? undefined, requestId: id, source: record.source, postId: record.postId ?? undefined, dedupeKey: `request:${id}:first-recipient-reply` });
      const eventId = await this.activity.record(tx, { type: 'marketplace_message_sent', entityType: this.entityType(record.kind), entityId: this.listingId(record), actorId: userId, companyId: userId === record.requesterId ? record.requesterCompanyId ?? undefined : record.recipientCompanyId ?? undefined, requestId: id, source: record.source, dedupeKey: `message:${sent.id}` });
      await this.activity.notify(tx, eventId, id, userId === record.requesterId ? record.recipientId : record.requesterId);
      return this.message(sent);
    }, WRITE_TRANSACTION);
  }
  async messages(userId: string, id: string, query: MarketplaceMessageQueryDto) {
    this.assertUuid(id); await this.participant(this.prisma, userId, id); const { page, limit } = this.query({ ...query, limit: query.limit ?? 50 });
    const where = { requestId: id };
    const [total, messages] = await this.prisma.$transaction([this.prisma.marketplaceMessage.count({ where }), this.prisma.marketplaceMessage.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit })]);
    return { data: messages.map(message => this.message(message)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  async read(userId: string, id: string) {
    this.assertUuid(id);
    return this.prisma.$transaction(async tx => { const record = await this.lockRequest(tx, userId, id), readAt = new Date(); await tx.marketplaceRequest.update({ where: { id }, data: { [userId === record.requesterId ? 'requesterLastReadAt' : 'recipientLastReadAt']: readAt } }); return { readAt }; }, WRITE_TRANSACTION);
  }
  async report(userId: string, id: string, dto: MarketplaceRequestReportDto) {
    this.assertUuid(id); if (!REQUEST_REPORT_REASONS.includes(dto.reason as any) || (dto.details !== undefined && (typeof dto.details !== 'string' || dto.details.length > 1000))) throw new BadRequestException('Invalid request report');
    return this.prisma.$transaction(async tx => {
      await this.lockRequest(tx, userId, id); const details = dto.details?.trim() || null;
      const where = { reporterId_requestId: { reporterId: userId, requestId: id } };
      const existing = await tx.marketplaceRequestReport.findUnique({ where, select: { reason: true, details: true } });
      const changed = !!existing && (existing.reason !== dto.reason || existing.details !== details);
      await tx.marketplaceRequestReport.upsert({ where, create: { requestId: id, reporterId: userId, reason: dto.reason, details }, update: { reason: dto.reason, details, ...(changed ? { status: 'open', reviewedAt: null, reviewedById: null } : {}) } });
      return { reported: true };
    }, WRITE_TRANSACTION);
  }
}
