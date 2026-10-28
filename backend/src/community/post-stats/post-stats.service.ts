import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { CompanyMemberStatus, Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import { ExclusiveCron } from '../../common/scheduling/exclusive-cron';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '../../common/types/user.types';
import { plainText } from '../mentions';
import { runsCompanyPage } from '../page-admins';

/** How long who-saw-what is kept. The totals on each post outlive it. */
export const POST_VIEW_RETENTION_DAYS = 90;
/** Days in a post's own chart. */
const POST_CHART_DAYS = 14;
/** One batch from a reader's screen; a page of the feed is twenty. */
const MAX_BATCH = 50;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight UTC, as the "YYYY-MM-DD" a date column takes. */
function utcDay(at: Date | number = Date.now()): string {
  return new Date(at).toISOString().slice(0, 10);
}

/**
 * How far a post travelled, for whoever wrote it — and a company's posts, for
 * the people who run its page.
 *
 * A **view** is a signed-in person having the post on screen, counted once
 * per person per day, the way profile impressions are: scrolling past it
 * twice before lunch is one, and coming back tomorrow is another. Never the
 * author, and never, for a company post, the company's own team — their
 * interest is not the audience's.
 *
 * Only numbers come out. Who viewed a post is kept for the dedupe and the
 * reach figure, and pruned after `POST_VIEW_RETENTION_DAYS`; nothing here
 * names a reader, and no endpoint lists them.
 */
@Injectable()
export class PostStatsService {
  private readonly logger = new Logger(PostStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Posts this reader had on screen. Returns how many counted as new views. */
  async recordViews(viewer: User, postIds: string[]): Promise<{ counted: number }> {
    const ids = [...new Set(postIds)].filter((id) => isUUID(id)).slice(0, MAX_BATCH);
    if (ids.length === 0) return { counted: 0 };

    const posts = await this.prisma.post.findMany({
      where: { id: { in: ids }, removedAt: null, authorId: { not: viewer.id } },
      select: { id: true, companyId: true },
    });
    const companyIds = [...new Set(posts.flatMap((p) => (p.companyId ? [p.companyId] : [])))];
    const seats = companyIds.length
      ? await this.prisma.companyMember.findMany({
          where: { userId: viewer.id, companyId: { in: companyIds }, status: CompanyMemberStatus.ACTIVE },
          select: { companyId: true },
        })
      : [];
    const ownTeam = new Set(seats.map((s) => s.companyId));
    const countable = posts.filter((p) => !p.companyId || !ownTeam.has(p.companyId)).map((p) => p.id);
    if (countable.length === 0) return { counted: 0 };

    // One row per post, person and day; a repeat changes nothing, and only a
    // new row adds to the post's total.
    const inserted = await this.prisma.$queryRaw<Array<{ post_id: string }>>`
      INSERT INTO post_views (post_id, viewer_id, day)
      SELECT unnest(${countable}::text[]), ${viewer.id}, ${utcDay()}::date
      ON CONFLICT DO NOTHING
      RETURNING post_id`;
    if (inserted.length > 0) {
      await this.prisma.$executeRaw`
        UPDATE posts SET views_count = views_count + 1
        WHERE id = ANY(${inserted.map((row) => row.post_id)}::text[])`;
    }
    return { counted: inserted.length };
  }

  /** One post's numbers: for its author, or for the people who run the company it speaks for. */
  async postStats(user: User, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true, authorId: true, companyId: true, removedAt: true, createdAt: true,
        viewsCount: true, likesCount: true, commentsCount: true, resharesCount: true,
      },
    });
    if (!post || post.removedAt) throw new NotFoundException('Post not found');
    const mayRead = post.companyId
      ? await runsCompanyPage(this.prisma, user.id, post.companyId)
      : post.authorId === user.id;
    if (!mayRead) throw new ForbiddenException("Only the post's author can see its stats.");

    const today = Date.parse(utcDay());
    const first = Math.max(Date.parse(utcDay(post.createdAt)), today - (POST_CHART_DAYS - 1) * DAY_MS);
    const [reach, days] = await Promise.all([
      this.prisma.$queryRaw<Array<{ people: number }>>`
        SELECT count(DISTINCT viewer_id)::int AS people FROM post_views WHERE post_id = ${post.id}`,
      this.prisma.$queryRaw<Array<{ day: Date; views: number }>>`
        SELECT day, count(*)::int AS views FROM post_views
        WHERE post_id = ${post.id} AND day >= ${utcDay(first)}::date
        GROUP BY day ORDER BY day`,
    ]);

    const engagements = post.likesCount + post.commentsCount + post.resharesCount;
    return {
      postId: post.id,
      publishedAt: post.createdAt,
      views: post.viewsCount,
      peopleReached: reach[0]?.people ?? 0,
      reactions: post.likesCount,
      comments: post.commentsCount,
      reshares: post.resharesCount,
      // Of the times it was seen, how often someone did something with it.
      engagementRate: post.viewsCount > 0 ? Math.round((engagements / post.viewsCount) * 1000) / 10 : null,
      daily: fillDays(first, today, days),
      retentionDays: POST_VIEW_RETENTION_DAYS,
    };
  }

  /**
   * A company page's last `days` days, for the people who run it; null for
   * anyone else, so the page can ask without first asking whether it may.
   */
  async companyInsights(user: User, companyId: string, days = 30) {
    if (!(await runsCompanyPage(this.prisma, user.id, companyId))) return null;
    const window = Math.min(Math.max(Math.round(days), 7), POST_VIEW_RETENTION_DAYS);
    const today = Date.parse(utcDay());
    const first = today - (window - 1) * DAY_MS;
    const since = new Date(first);
    const sinceDay = utcDay(first);
    const live: Prisma.PostWhereInput = { companyId, removedAt: null };

    const [published, viewTotals, daily, reactions, comments, reshares, followersGained, followers, top] = await Promise.all([
      this.prisma.post.count({ where: { ...live, createdAt: { gte: since } } }),
      this.prisma.$queryRaw<Array<{ views: number; people: number }>>`
        SELECT count(*)::int AS views, count(DISTINCT v.viewer_id)::int AS people
        FROM post_views v JOIN posts p ON p.id = v.post_id
        WHERE p.company_id = ${companyId} AND p.removed_at IS NULL AND v.day >= ${sinceDay}::date`,
      this.prisma.$queryRaw<Array<{ day: Date; views: number }>>`
        SELECT v.day, count(*)::int AS views
        FROM post_views v JOIN posts p ON p.id = v.post_id
        WHERE p.company_id = ${companyId} AND p.removed_at IS NULL AND v.day >= ${sinceDay}::date
        GROUP BY v.day ORDER BY v.day`,
      this.prisma.postLike.count({ where: { createdAt: { gte: since }, post: live } }),
      this.prisma.postComment.count({ where: { createdAt: { gte: since }, removedAt: null, post: live } }),
      this.prisma.post.count({ where: { createdAt: { gte: since }, removedAt: null, resharedFrom: live } }),
      this.prisma.companyFollow.count({ where: { createdAt: { gte: since }, company: { companyId } } }),
      this.prisma.companyFollow.count({ where: { company: { companyId } } }),
      // The posts most seen in the window — old ones still being read count too.
      this.prisma.$queryRaw<Array<{
        id: string; content: string; created_at: Date; document_title: string | null; media: number;
        window_views: number; views_count: number; likes_count: number; comments_count: number; reshares_count: number;
      }>>`
        SELECT p.id, p.content, p.created_at, p.document_title, cardinality(p.media_urls)::int AS media,
               count(v.post_id)::int AS window_views, p.views_count, p.likes_count, p.comments_count, p.reshares_count
        FROM posts p
        LEFT JOIN post_views v ON v.post_id = p.id AND v.day >= ${sinceDay}::date
        WHERE p.company_id = ${companyId} AND p.removed_at IS NULL
        GROUP BY p.id
        HAVING count(v.post_id) > 0 OR p.created_at >= ${since}
        ORDER BY window_views DESC, p.created_at DESC
        LIMIT 5`,
    ]);

    return {
      days: window,
      since,
      published,
      views: viewTotals[0]?.views ?? 0,
      peopleReached: viewTotals[0]?.people ?? 0,
      reactions,
      comments,
      reshares,
      followers,
      followersGained,
      daily: fillDays(first, today, daily),
      topPosts: top.map((p) => ({
        id: p.id,
        preview: preview(p.content, p.document_title, p.media),
        publishedAt: p.created_at,
        views: p.window_views,
        totalViews: p.views_count,
        reactions: p.likes_count,
        comments: p.comments_count,
        reshares: p.reshares_count,
      })),
    };
  }

  /** Who saw what is kept only as long as the numbers that need it. */
  @ExclusiveCron(CronExpression.EVERY_DAY_AT_5AM, { name: 'post-view-retention', timeZone: 'UTC' })
  async pruneViews(now = Date.now()): Promise<void> {
    try {
      const cutoff = new Date(Date.parse(utcDay(now)) - POST_VIEW_RETENTION_DAYS * DAY_MS);
      const { count } = await this.prisma.postView.deleteMany({ where: { day: { lt: cutoff } } });
      if (count > 0) this.logger.log(`Pruned ${count} post view(s) older than ${POST_VIEW_RETENTION_DAYS} days.`);
    } catch (err) {
      this.logger.error(`Post view retention failed: ${(err as Error).message}`);
    }
  }
}

/** Every day from `first` to `last`, with the views counted on it or zero. */
function fillDays(first: number, last: number, rows: Array<{ day: Date; views: number }>) {
  const byDay = new Map(rows.map((r) => [utcDay(r.day), r.views]));
  const out: Array<{ day: string; views: number }> = [];
  for (let at = first; at <= last; at += DAY_MS) out.push({ day: utcDay(at), views: byDay.get(utcDay(at)) ?? 0 });
  return out;
}

/** A line to recognise a post by: its words as read, or what it carries. */
function preview(content: string, documentTitle: string | null, media: number): string {
  const words = plainText(content).replace(/\s+/g, ' ').trim();
  if (words) return words.length > 140 ? `${words.slice(0, 139).trimEnd()}…` : words;
  if (documentTitle) return documentTitle;
  return media > 0 ? 'A post with pictures' : 'A post';
}
