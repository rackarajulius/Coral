import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HIDDEN_STATUSES } from './people-follow.service';

/** Whether the viewer follows someone, and how many people do. */
export interface FollowState {
  isFollowing: boolean;
  followerCount: number;
}

/**
 * What a post needs to say who to follow: its company page, or its author.
 * The company is read as the feed sends it — its page as `profiles[0]`, put
 * there by PostsService.withCompanyLogos, whose declared type still says
 * `page` — so it is typed loosely here and read by shape.
 */
interface Followable {
  authorId: string;
  company?: unknown;
}

const logger = new Logger('FollowState');

/**
 * Follow state for a page of posts, in one round of four queries: the
 * follower counts and the viewer's own follows, for every company page and
 * every author on the page at once.
 *
 * Sent with the posts so a feed doesn't then ask about each company and each
 * author separately — which was a request per post, arriving seconds after
 * the posts and making every Follow button and follower count pop in late.
 *
 * The same rules as the single lookups: a company is followed through its
 * page (employers.service getFollowStatus), and a person's count leaves out
 * followers whose accounts are closed, suspended or banned (people-follow).
 */
export async function followStateFor<T extends Followable>(
  prisma: PrismaService,
  posts: T[],
  viewerId?: string,
): Promise<Array<T & { companyFollow: FollowState | null; authorFollow: FollowState | null }>> {
  const pageOf = (post: T) =>
    (post.company as { profiles?: Array<{ id: string }> } | null | undefined)?.profiles?.[0]?.id ?? null;
  const pageIds = [...new Set(posts.map(pageOf).filter((id): id is string => !!id))];
  // A company post speaks for the company; its writer is not who to follow.
  const authorIds = [...new Set(posts.filter((post) => !post.company).map((post) => post.authorId))];

  let companies = new Map<string, FollowState>();
  let people = new Map<string, FollowState>();
  try {
    const [companyCounts, companiesMine, peopleCounts, peopleMine] = await Promise.all([
      pageIds.length
        ? prisma.companyFollow.groupBy({ by: ['companyId'], where: { companyId: { in: pageIds } }, _count: { _all: true } })
        : [],
      pageIds.length && viewerId
        ? prisma.companyFollow.findMany({ where: { userId: viewerId, companyId: { in: pageIds } }, select: { companyId: true } })
        : [],
      authorIds.length
        ? prisma.userFollow.groupBy({
            by: ['followingId'],
            where: { followingId: { in: authorIds }, follower: { status: { notIn: HIDDEN_STATUSES } } },
            _count: { _all: true },
          })
        : [],
      authorIds.length && viewerId
        ? prisma.userFollow.findMany({ where: { followerId: viewerId, followingId: { in: authorIds } }, select: { followingId: true } })
        : [],
    ]);
    const followedPages = new Set(companiesMine.map((f) => f.companyId));
    const followedPeople = new Set(peopleMine.map((f) => f.followingId));
    const companyCount = new Map(companyCounts.map((c) => [c.companyId, c._count._all]));
    const personCount = new Map(peopleCounts.map((c) => [c.followingId, c._count._all]));
    companies = new Map(pageIds.map((id) => [id, { isFollowing: followedPages.has(id), followerCount: companyCount.get(id) ?? 0 }]));
    people = new Map(authorIds.map((id) => [id, { isFollowing: followedPeople.has(id), followerCount: personCount.get(id) ?? 0 }]));
  } catch (err) {
    // Decoration, not the feed: without it the page asks per post, as before.
    logger.warn(`Follow state skipped: ${(err as Error).message}`);
  }

  return posts.map((post) => {
    const page = pageOf(post);
    return {
      ...post,
      companyFollow: page ? companies.get(page) ?? null : null,
      authorFollow: post.company ? null : people.get(post.authorId) ?? null,
    };
  });
}
