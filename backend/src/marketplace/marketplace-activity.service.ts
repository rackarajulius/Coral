import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CronExpression } from '@nestjs/schedule';
import { createHash } from 'node:crypto';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { PrismaService } from '../prisma/prisma.service';
import { WRITE_TRANSACTION } from '../common/database-transaction';
import { MarketplaceService } from './marketplace.service';
import { ListingKind } from './marketplace-policy';

const EVENT_TYPES = ['listing_view', 'service_enquiry_submitted', 'project_response_submitted', 'marketplace_request_accepted',
  'marketplace_recipient_replied', 'marketplace_message_sent', 'marketplace_request_state_changed',
  'marketplace_request_declined', 'marketplace_request_withdrawn', 'marketplace_request_blocked'] as const;
export interface MarketplaceActivityInput {
  type: string; entityType: string; entityId: string; actorId?: string | null; companyId?: string | null;
  requestId?: string | null; source?: string; postId?: string | null; sessionId?: string | null; dedupeKey: string;
}

/** Structural events and durable in-app delivery; private text never enters either. */
@Injectable()
export class MarketplaceActivityService {
  private readonly logger = new Logger(MarketplaceActivityService.name);
  constructor(private readonly prisma: PrismaService, private readonly marketplace: MarketplaceService) {}

  async record(tx: Prisma.TransactionClient, input: MarketplaceActivityInput): Promise<string> {
    if (!(EVENT_TYPES as readonly string[]).includes(input.type) || !input.dedupeKey || input.dedupeKey.length > 500
      || !['direct', 'community', 'directory', 'profile'].includes(input.source ?? 'direct')) throw new BadRequestException('Invalid marketplace event');
    const event = await tx.marketplaceEvent.upsert({ where: { dedupeKey: input.dedupeKey }, update: { dedupeKey: input.dedupeKey },
      create: { type: input.type, entityType: input.entityType, entityId: input.entityId, actorId: input.actorId ?? null,
        companyId: input.companyId ?? null, requestId: input.requestId ?? null, source: input.source ?? 'direct',
        postId: input.postId ?? null, sessionId: input.sessionId ?? null, dedupeKey: input.dedupeKey, properties: {} }, select: { id: true } });
    return event.id;
  }

  async notify(tx: Prisma.TransactionClient, eventId: string, requestId: string, userId: string): Promise<void> {
    await tx.marketplaceDelivery.upsert({ where: { eventId_userId: { eventId, userId } }, update: {}, create: { eventId, requestId, userId } });
  }

  async listingView(input: { kind: ListingKind; listingId: string; sessionId: string; source?: string; postId?: string }, actorId?: string) {
    const listing = await this.marketplace.getPublic(input.kind, input.listingId);
    const source = input.source ?? 'direct';
    if (source === 'community') {
      if (!input.postId) throw new BadRequestException('A community view needs its originating post');
      const post = await this.prisma.post.findUnique({ where: { id: input.postId }, select: { removedAt: true, linkedServiceListingId: true, linkedGigId: true,
        authorId: true, companyId: true, purpose: true, author: { select: { status: true } } } });
      if (!post || post.removedAt || post.author.status !== 'ACTIVE' || !await this.currentCompanySeat(this.prisma, post.authorId, post.companyId)
        || (input.kind === 'service' ? post.linkedServiceListingId !== input.listingId || !['SERVICE_ANNOUNCEMENT', 'SHOWCASE'].includes(post.purpose)
          : post.linkedGigId !== input.listingId || post.purpose !== 'OPPORTUNITY'))
        throw new BadRequestException('The originating post does not reference this listing');
    } else if (input.postId) throw new BadRequestException('A post reference requires a community source');
    // Stable database key across instances/restarts. A session is an untrusted,
    // pseudonymous browser token: this counts views, never verified people.
    const window = Math.floor(Date.now() / (30 * 60_000));
    const dedupeKey = createHash('sha256').update(`listing_view|${input.kind}|${input.listingId}|${input.sessionId}|${window}`).digest('hex');
    await this.prisma.$transaction(tx => this.record(tx, { type: 'listing_view', entityType: input.kind === 'service' ? 'service_listing' : 'project_brief',
      entityId: input.listingId, actorId, companyId: listing.company?.id, source, postId: input.postId, sessionId: input.sessionId, dedupeKey }));
    return { recorded: true };
  }

  @ExclusiveCron(CronExpression.EVERY_MINUTE, { name: 'marketplace-notification-delivery', timeZone: 'UTC' })
  async deliverPending() {
    const pending = await this.prisma.marketplaceDelivery.findMany({ where: { status: 'pending', nextAttemptAt: { lte: new Date() } },
      orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }], take: 50, select: { id: true } });
    let delivered = 0, cancelled = 0, failed = 0;
    for (const candidate of pending) {
      try {
        const outcome = await this.prisma.$transaction(async tx => {
          const locks = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM marketplace_deliveries WHERE id = ${candidate.id} FOR UPDATE SKIP LOCKED`);
          if (!locks.length) return 'skipped';
          let row = await tx.marketplaceDelivery.findUnique({ where: { id: candidate.id }, include: { request: {
            include: { requester: { select: { status: true } }, recipient: { select: { status: true } } } } } });
          if (!row || row.status !== 'pending' || row.nextAttemptAt > new Date()) return 'skipped';
          // Match contact mutations: blocking, account status and seat changes
          // cannot commit between the authorization check and delivery.
          for (const actorId of [row.request.requesterId, row.request.recipientId].sort())
            await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${actorId} FOR UPDATE`);
          const seats: Array<[string | null, string]> = [[row.request.requesterCompanyId, row.request.requesterId], [row.request.recipientCompanyId, row.request.recipientId]];
          for (const [companyId, actorId] of seats.sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`)))
            if (companyId) await tx.$queryRaw(Prisma.sql`SELECT id FROM company_members WHERE company_id = ${companyId} AND user_id = ${actorId} FOR UPDATE`);
          row = await tx.marketplaceDelivery.findUnique({ where: { id: candidate.id }, include: { request: {
            include: { requester: { select: { status: true } }, recipient: { select: { status: true } } } } } });
          if (!row || row.status !== 'pending') return 'skipped';
          const request = row.request;
          const blocked = await tx.marketplaceBlock.findFirst({ where: { OR: [
            { blockerId: request.requesterId, blockedId: request.recipientId }, { blockerId: request.recipientId, blockedId: request.requesterId }] }, select: { id: true } });
          const isParticipant = [request.requesterId, request.recipientId].includes(row.userId);
          if (!isParticipant || request.status === 'blocked' || blocked || request.requester.status !== 'ACTIVE' || request.recipient.status !== 'ACTIVE'
            || !await this.currentCompanySeat(tx, request.requesterId, request.requesterCompanyId)
            || !await this.currentCompanySeat(tx, request.recipientId, request.recipientCompanyId)) {
            await tx.marketplaceDelivery.update({ where: { id: row.id }, data: { status: 'cancelled', lastError: null } });
            return 'cancelled';
          }
          // Stable notification ID and delivery update commit together. A crash
          // or second worker cannot produce two notification rows.
          await tx.notification.upsert({ where: { id: row.notificationId }, update: {}, create: { id: row.notificationId, userId: row.userId,
            type: 'marketplace', title: 'Marketplace request update', message: 'There is an update in your private marketplace inbox.',
            link: `/marketplace/inbox?request=${row.requestId}` } });
          await tx.marketplaceDelivery.update({ where: { id: row.id }, data: { status: 'delivered', deliveredAt: new Date(), attempts: { increment: 1 }, lastError: null } });
          return 'delivered';
        }, WRITE_TRANSACTION);
        if (outcome === 'delivered') delivered++;
        if (outcome === 'cancelled') cancelled++;
      } catch {
        failed++;
        // Do not persist exception text: database errors can quote private values.
        const row = await this.prisma.marketplaceDelivery.findUnique({ where: { id: candidate.id }, select: { attempts: true } });
        if (row) await this.prisma.marketplaceDelivery.updateMany({ where: { id: candidate.id, status: 'pending' }, data: {
          attempts: { increment: 1 }, lastError: 'delivery_failed', nextAttemptAt: new Date(Date.now() + Math.min(60 * 60_000, 60_000 * 2 ** Math.min(row.attempts, 6))) } });
        this.logger.warn('Marketplace notification delivery deferred');
      }
    }
    return { examined: pending.length, delivered, cancelled, failed };
  }

  @ExclusiveCron(CronExpression.EVERY_DAY_AT_5AM, { name: 'marketplace-event-retention', timeZone: 'UTC' })
  async pruneEvents() {
    // Events carry internal actor IDs and are restricted data, not anonymous.
    // Leave pending deliveries intact for recovery even beyond telemetry TTL.
    await this.prisma.marketplaceEvent.deleteMany({ where: { occurredAt: { lt: new Date(Date.now() - 90 * 86400_000) }, deliveries: { none: { status: 'pending' } } } });
  }

  async metrics(userId: string, days = 30) {
    await this.assertAdmin(this.prisma, userId);
    if (!Number.isInteger(days) || days < 1 || days > 90) throw new BadRequestException('Choose between 1 and 90 days');
    const since = new Date(Date.now() - days * 86400_000);
    const [events, requests, pendingDeliveries] = await Promise.all([
      this.prisma.marketplaceEvent.groupBy({ by: ['type', 'source'], where: { occurredAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.marketplaceRequest.groupBy({ by: ['kind', 'status'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.marketplaceDelivery.count({ where: { status: 'pending' } }),
    ]);
    return { days, since, events: events.map(row => ({ type: row.type, source: row.source, count: row._count._all })),
      requests: requests.map(row => ({ kind: row.kind, status: row.status, count: row._count._all })), pendingDeliveries,
      definitions: { listing_view: 'One listing view per declared browser session and 30-minute window; not unique verified people.',
        marketplace_recipient_replied: 'First recipient reply; not a contract or completed project.' } };
  }

  async requestReports(userId: string, status = 'open') {
    await this.assertAdmin(this.prisma, userId);
    if (!['open', 'reviewed'].includes(status)) throw new BadRequestException('Invalid review status');
    return this.prisma.marketplaceRequestReport.findMany({ where: { status }, take: 200, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, reason: true, details: true, status: true, createdAt: true, reviewedAt: true } });
  }

  async reviewRequestReport(userId: string, id: string) {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
      await this.assertAdmin(tx, userId);
      const report = await tx.marketplaceRequestReport.findUnique({ where: { id }, select: { id: true } });
      if (!report) throw new NotFoundException('Report not available');
      await tx.marketplaceRequestReport.updateMany({ where: { id, status: 'open' }, data: { status: 'reviewed', reviewedAt: new Date(), reviewedById: userId } });
      return { reviewed: true };
    }, WRITE_TRANSACTION);
  }

  private async currentCompanySeat(tx: Prisma.TransactionClient, userId: string, companyId: string | null) {
    if (!companyId) return true;
    const seat = await tx.companyMember.findUnique({ where: { companyId_userId: { companyId, userId } }, select: { status: true, role: true } });
    return !!seat && seat.status === 'ACTIVE' && ['OWNER', 'ADMIN'].includes(seat.role);
  }
  private async assertAdmin(db: Prisma.TransactionClient | PrismaService, userId: string) {
    const actor = await db.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
    if (!actor || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') throw new ForbiddenException('Platform administrator access is required');
  }
}
