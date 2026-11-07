import { Injectable } from '@nestjs/common';
import { Prisma, ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Where a report about someone's content came from. */
export type ReportSource = 'posts' | 'comments' | 'reviews' | 'listings' | 'requests';

/**
 * What became of a report.
 *
 * `reviewed` is the marketplace queues' only closed state: they record that an
 * admin looked, not what was decided, so it is shown as that rather than
 * guessed into upheld or dismissed.
 */
export type ReportOutcome = 'open' | 'upheld' | 'dismissed' | 'reviewed';

interface ReportRow {
  userId: string;
  source: ReportSource;
  outcome: ReportOutcome;
  reason: string;
  createdAt: Date;
}

/**
 * A person's moderation record, built from facts the queues already hold.
 *
 * Deliberately not a risk score. A number or a Low/High label about a job
 * seeker is a judgement about a person, and once it exists it gets used to
 * decide things no one can then explain. What an admin needs is what happened:
 * reports about what they wrote and how each was decided, what moderators took
 * down, and what was done to the account. Every count here can be traced to
 * rows, and a dismissed report is shown apart from an upheld one — being
 * reported is not evidence.
 *
 * The same rule applies to what is left out: AI-screen integrity signals are
 * observations "never actionable automatically", and are not read here.
 */
@Injectable()
export class ModerationRecordService {
  constructor(private readonly prisma: PrismaService) {}

  /** Users with at least one open report about something they wrote. */
  openReportsWhere(): Prisma.UserWhereInput {
    return {
      OR: [
        { posts: { some: { reports: { some: { status: ReportStatus.OPEN } } } } },
        { postComments: { some: { reports: { some: { status: ReportStatus.OPEN } } } } },
        // As the review queue counts them: flags on reviews that are live.
        { companyReviews: { some: { status: 'published', flags: { some: { resolvedAt: null } } } } },
        { serviceListings: { some: { reports: { some: { status: 'open' } } } } },
        { projectBriefs: { some: { reports: { some: { status: 'open' } } } } },
        { marketplaceRequestsMade: { some: { reports: { some: { status: 'open' } } } } },
      ],
    };
  }

  /** Open reports per person, for a page of the admin list. */
  async openReportCounts(userIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (!userIds.length) return counts;
    for (const row of await this.reportsAbout(userIds, true)) {
      counts.set(row.userId, (counts.get(row.userId) ?? 0) + 1);
    }
    return counts;
  }

  /** The full record for one person, shown in their admin drawer. */
  async recordFor(userId: string) {
    const [reports, removed, accountActions, identity] = await Promise.all([
      this.reportsAbout([userId], false),
      this.removedContent(userId),
      this.accountActions(userId),
      this.prisma.verification.findFirst({
        where: { userId, type: 'IDENTITY' },
        orderBy: { createdAt: 'desc' },
        select: { status: true, createdAt: true, reviewedAt: true },
      }),
    ]);

    const sources: ReportSource[] = ['posts', 'comments', 'reviews', 'listings', 'requests'];
    const bySource = sources
      .map((source) => {
        const rows = reports.filter((r) => r.source === source);
        const count = (o: ReportOutcome) => rows.filter((r) => r.outcome === o).length;
        return { source, open: count('open'), upheld: count('upheld'), dismissed: count('dismissed'), reviewed: count('reviewed') };
      })
      .filter((s) => s.open + s.upheld + s.dismissed + s.reviewed > 0);

    return {
      reports: bySource,
      // The latest few, so an admin sees what people said, not only how many.
      recent: reports
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 8)
        .map(({ source, outcome, reason, createdAt }) => ({ source, outcome, reason, createdAt: createdAt.toISOString() })),
      removed,
      accountActions,
      identity: identity
        ? {
            status: identity.status,
            at: (identity.reviewedAt ?? identity.createdAt).toISOString(),
          }
        : null,
    };
  }

  /** Every report about content these people wrote, from all five places. */
  private async reportsAbout(userIds: string[], openOnly: boolean): Promise<ReportRow[]> {
    const ids = { in: userIds };
    const [postReports, reviewFlags, listingReports, requestReports] = await Promise.all([
      this.prisma.postReport.findMany({
        where: {
          ...(openOnly ? { status: ReportStatus.OPEN } : {}),
          OR: [{ post: { authorId: ids } }, { comment: { authorId: ids } }],
        },
        select: {
          status: true,
          reason: true,
          createdAt: true,
          post: { select: { authorId: true } },
          comment: { select: { authorId: true } },
        },
      }),
      this.prisma.reviewFlag.findMany({
        where: openOnly
          ? { resolvedAt: null, review: { status: 'published', authorId: ids } }
          : { review: { authorId: ids } },
        select: { resolvedAt: true, outcome: true, reason: true, createdAt: true, review: { select: { authorId: true } } },
      }),
      this.prisma.marketplaceReport.findMany({
        where: {
          ...(openOnly ? { status: 'open' } : {}),
          OR: [{ serviceListing: { ownerUserId: ids } }, { projectBrief: { ownerUserId: ids } }],
        },
        select: {
          status: true,
          reason: true,
          createdAt: true,
          serviceListing: { select: { ownerUserId: true } },
          projectBrief: { select: { ownerUserId: true } },
        },
      }),
      this.prisma.marketplaceRequestReport.findMany({
        where: { ...(openOnly ? { status: 'open' } : {}), request: { requesterId: ids } },
        select: { status: true, reason: true, createdAt: true, request: { select: { requesterId: true } } },
      }),
    ]);

    const rows: ReportRow[] = [];
    for (const r of postReports) {
      const userId = r.post?.authorId ?? r.comment?.authorId;
      if (!userId) continue;
      rows.push({
        userId,
        source: r.post ? 'posts' : 'comments',
        outcome: r.status === ReportStatus.OPEN ? 'open' : r.status === ReportStatus.ACTIONED ? 'upheld' : 'dismissed',
        reason: r.reason,
        createdAt: r.createdAt,
      });
    }
    for (const f of reviewFlags) {
      rows.push({
        userId: f.review.authorId,
        source: 'reviews',
        // A flag is closed by the review decision: removed upholds it,
        // published again dismisses it.
        outcome: !f.resolvedAt ? 'open' : f.outcome === 'remove' ? 'upheld' : 'dismissed',
        reason: f.reason,
        createdAt: f.createdAt,
      });
    }
    for (const r of listingReports) {
      const userId = r.serviceListing?.ownerUserId ?? r.projectBrief?.ownerUserId;
      if (!userId) continue;
      rows.push({ userId, source: 'listings', outcome: r.status === 'open' ? 'open' : 'reviewed', reason: r.reason, createdAt: r.createdAt });
    }
    for (const r of requestReports) {
      rows.push({
        userId: r.request.requesterId,
        source: 'requests',
        outcome: r.status === 'open' ? 'open' : 'reviewed',
        reason: r.reason,
        createdAt: r.createdAt,
      });
    }
    return rows;
  }

  /** What moderators took down. Self-deleted content is not counted. */
  private async removedContent(userId: string) {
    const [posts, comments, reviews, services, briefs] = await Promise.all([
      this.prisma.post.count({ where: { authorId: userId, removedAt: { not: null } } }),
      this.prisma.postComment.count({ where: { authorId: userId, removedAt: { not: null } } }),
      this.prisma.companyReview.count({ where: { authorId: userId, status: 'removed' } }),
      this.prisma.serviceListing.count({ where: { ownerUserId: userId, removedAt: { not: null } } }),
      this.prisma.projectBrief.count({ where: { ownerUserId: userId, removedAt: { not: null } } }),
    ]);
    return { posts, comments, reviews, listings: services + briefs };
  }

  /** Suspensions, bans and reinstatements, from the audit log, newest first. */
  private async accountActions(userId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: { entityType: 'Jobseeker', entityId: userId, changeSummary: { startsWith: 'Status:' } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        changeSummary: true,
        createdAt: true,
        admin: { select: { displayName: true, firstName: true, lastName: true, email: true } },
      },
    });
    return rows.map((r) => ({
      summary: r.changeSummary ?? '',
      at: r.createdAt.toISOString(),
      by:
        r.admin.displayName ||
        `${r.admin.firstName || ''} ${r.admin.lastName || ''}`.trim() ||
        r.admin.email,
    }));
  }
}
