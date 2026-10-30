import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WRITE_TRANSACTION } from '../common/database-transaction';
import { ListingKind } from './marketplace-policy';
import { COMMUNITY_BUCKET, StorageService } from '../storage/storage.service';

/** Marketplace reports are a platform queue. Space moderation grants no access. */
@Injectable()
export class MarketplaceModerationService {
  private readonly logger = new Logger(MarketplaceModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    /** Deletes a removed service's pictures and video. */
    @Optional() private readonly storage?: StorageService,
  ) {}

  async list(userId: string, status = 'open') {
    await this.assertAdmin(this.prisma, userId);
    if (!['open', 'reviewed'].includes(status)) throw new BadRequestException('Invalid review status');
    const rows = await this.prisma.marketplaceReport.findMany({
      where: { status }, take: 200, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, reason: true, details: true, createdAt: true, status: true, reviewedAt: true,
        serviceListing: { select: { id: true, title: true, description: true, deliverables: true, status: true, removedAt: true } },
        projectBrief: { select: { id: true, title: true, description: true, scope: true, status: true, removedAt: true } } },
    });
    return rows.map(row => {
      const target = row.serviceListing ?? row.projectBrief;
      return { id: row.id, reason: row.reason, details: row.details, createdAt: row.createdAt,
        status: row.status, reviewedAt: row.reviewedAt, kind: row.serviceListing ? 'service' : 'project',
        target: target ? { id: target.id, title: target.title, description: target.description,
          scope: row.projectBrief?.scope ?? null, deliverables: row.serviceListing?.deliverables ?? [],
          status: target.status, removed: !!target.removedAt } : null };
    });
  }

  async review(userId: string, reportId: string) {
    return this.prisma.$transaction(async tx => {
      await this.lockAdmin(tx, userId);
      const existing = await tx.marketplaceReport.findUnique({ where: { id: reportId }, select: { id: true, status: true } });
      if (!existing) throw new NotFoundException('Report not available');
      await tx.marketplaceReport.updateMany({ where: { id: reportId, status: 'open' },
        data: { status: 'reviewed', reviewedAt: new Date(), reviewedById: userId } });
      return { reviewed: true };
    }, WRITE_TRANSACTION);
  }

  async setRemoval(userId: string, kind: ListingKind, id: string, removed: boolean, reason?: string) {
    if (!['service', 'project'].includes(kind)) throw new BadRequestException('Invalid listing kind');
    if (removed && (typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 1000)) {
      throw new BadRequestException('Enter a removal reason between 3 and 1000 characters');
    }
    const outcome = await this.prisma.$transaction(async tx => {
      await this.lockAdmin(tx, userId);
      if (kind === 'service') await tx.$queryRaw(Prisma.sql`SELECT id FROM service_listings WHERE id = ${id} FOR UPDATE`);
      else await tx.$queryRaw(Prisma.sql`SELECT id FROM project_briefs WHERE id = ${id} FOR UPDATE`);
      const service = kind === 'service' ? await tx.serviceListing.findUnique({ where: { id }, select: { id: true, mediaUrls: true } }) : null;
      const existing = service ?? (kind === 'project' ? await tx.projectBrief.findUnique({ where: { id }, select: { id: true } }) : null);
      if (!existing) throw new NotFoundException('Listing not available');
      const data = { removedAt: removed ? new Date() : null };
      /**
       * The words are kept for review and the pictures are not, as with a
       * removed post: a public file outlives the listing vanishing, so with an
       * abusive picture continued hosting is the harm. A restored service
       * comes back without them rather than with broken frames.
       */
      if (kind === 'service') await tx.serviceListing.update({ where: { id }, data: { ...data, ...(removed ? {} : { mediaUrls: [] }) } });
      else await tx.projectBrief.update({ where: { id }, data });
      // The reason is retained in the platform audit record, not the public card.
      await tx.auditLog.create({ data: { adminId: userId,
        action: removed ? 'marketplace.listing.remove' : 'marketplace.listing.restore',
        entityType: kind === 'service' ? 'service_listing' : 'project_brief', entityId: id,
        changeSummary: removed ? reason!.trim() : 'Restored marketplace visibility subject to current publication and consent rules',
        after: { removed } } });
      return { removed, media: removed ? service?.mediaUrls ?? [] : [] };
    }, WRITE_TRANSACTION);
    // After the decision is committed, and never failing it.
    for (const url of outcome.media) await this.deleteFile(url);
    return { removed: outcome.removed };
  }

  private async deleteFile(url: string) {
    if (!this.storage) return;
    try {
      const marker = `/${COMMUNITY_BUCKET}/`;
      const path = new URL(url).pathname;
      const at = path.indexOf(marker);
      if (at >= 0) await this.storage.deletePublicFile(path.slice(at + marker.length), COMMUNITY_BUCKET);
    } catch (error) {
      this.logger.warn(`Could not delete a removed service's media: ${(error as Error).message}`);
    }
  }

  private async assertAdmin(db: Prisma.TransactionClient | PrismaService, userId: string) {
    const actor = await db.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
    if (!actor || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') throw new ForbiddenException('Platform administrator access is required');
  }
  private async lockAdmin(tx: Prisma.TransactionClient, userId: string) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
    await this.assertAdmin(tx, userId);
  }
}
