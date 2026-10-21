import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WRITE_TRANSACTION } from '../common/database-transaction';
import { ListingKind } from './marketplace-policy';

/** Marketplace reports are a platform queue. Space moderation grants no access. */
@Injectable()
export class MarketplaceModerationService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.$transaction(async tx => {
      await this.lockAdmin(tx, userId);
      if (kind === 'service') await tx.$queryRaw(Prisma.sql`SELECT id FROM service_listings WHERE id = ${id} FOR UPDATE`);
      else await tx.$queryRaw(Prisma.sql`SELECT id FROM project_briefs WHERE id = ${id} FOR UPDATE`);
      const existing = kind === 'service' ? await tx.serviceListing.findUnique({ where: { id }, select: { id: true } })
        : await tx.projectBrief.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new NotFoundException('Listing not available');
      const data = { removedAt: removed ? new Date() : null };
      if (kind === 'service') await tx.serviceListing.update({ where: { id }, data });
      else await tx.projectBrief.update({ where: { id }, data });
      // The reason is retained in the platform audit record, not the public card.
      await tx.auditLog.create({ data: { adminId: userId,
        action: removed ? 'marketplace.listing.remove' : 'marketplace.listing.restore',
        entityType: kind === 'service' ? 'service_listing' : 'project_brief', entityId: id,
        changeSummary: removed ? reason!.trim() : 'Restored marketplace visibility subject to current publication and consent rules',
        after: { removed } } });
      return { removed };
    }, WRITE_TRANSACTION);
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
