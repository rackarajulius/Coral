import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SpaceKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SpacesService } from './spaces.service';
import {
  ActivityRow,
  HALF_LIFE_DAYS,
  LOOKBACK_DAYS,
  MAX_PEER_SPACE_SIZE,
  MIN_SHARED_MEMBERS,
  PeerRow,
  ProfileTerms,
  rankSuggestions,
} from './space-suggestions';

/**
 * How many of the busiest spaces are considered alongside the ones the viewer
 * has a signal for. Profile matching and the popular fill only look this far,
 * which keeps the cost flat however many spaces there are.
 */
const POPULAR_POOL = 200;

/**
 * Spaces suggested to one person, from what they have done.
 *
 * The signals are the viewer's own: posts they commented on, liked, saved,
 * voted in or reshared in spaces they have not joined; tides they signed up
 * for; who they share spaces with; and their profile. Job applications and
 * saved jobs are deliberately not used — they are private hiring activity, and
 * "because you applied to MTN" on a card is a disclosure to anyone looking at
 * the screen.
 *
 * The ranking itself is in `space-suggestions.ts`; this gathers its inputs.
 */
@Injectable()
export class SpaceSuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: SpacesService,
  ) {}

  async suggest(userId: string, limit = 10) {
    const [activity, peers, profile, mine] = await Promise.all([
      this.activity(userId),
      this.peers(userId),
      this.profile(userId),
      this.prisma.spaceMember.findMany({
        where: { userId, space: { archivedAt: null } },
        select: { space: { select: { id: true, name: true } } },
      }),
    ]);

    /**
     * TOPIC spaces only. A COMPANY space is that company's verified people;
     * offering it to everyone who reads its posts would be inviting them into
     * a room that is not theirs.
     */
    const eligible: Prisma.SpaceWhereInput = {
      archivedAt: null,
      kind: SpaceKind.TOPIC,
      members: { none: { userId } },
      suggestionDismissals: { none: { userId } },
    };
    const include = {
      // Removed posts are gone from every listing, so a space whose only posts
      // were removed is an empty room and is counted as one.
      _count: { select: { members: true, posts: { where: { removedAt: null } } } },
      company: { select: { id: true, name: true } },
    } satisfies Prisma.SpaceInclude;

    const signalled = [...new Set([...activity, ...peers].map((r) => r.spaceId))];
    const [popular, withSignals] = await Promise.all([
      this.prisma.space.findMany({
        where: eligible,
        orderBy: [{ members: { _count: 'desc' } }, { posts: { _count: 'desc' } }, { name: 'asc' }],
        take: POPULAR_POOL,
        include,
      }),
      signalled.length > 0
        ? this.prisma.space.findMany({ where: { ...eligible, id: { in: signalled } }, include })
        : Promise.resolve([]),
    ]);

    // One list, busiest first — the order the ranking falls back on.
    const byId = new Map([...popular, ...withSignals].map((s) => [s.id, s]));
    const candidates = [...byId.values()].sort(
      (a, b) =>
        b._count.members - a._count.members ||
        b._count.posts - a._count.posts ||
        a.name.localeCompare(b.name),
    );

    const ranked = rankSuggestions({
      candidates: candidates.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        postCount: s._count.posts,
      })),
      activity,
      peers,
      profile,
      spaceNames: new Map(mine.map((m) => [m.space.id, m.space.name])),
      limit,
    });

    return ranked.map((r) => ({
      ...this.spaces.shape(byId.get(r.spaceId)!, false),
      reason: r.reason,
    }));
  }

  /**
   * "Not interested". Idempotent, like joining: closing the same card twice
   * means the same thing both times.
   */
  async dismiss(userId: string, spaceId: string) {
    const space = await this.prisma.space.findUnique({ where: { id: spaceId }, select: { id: true } });
    if (!space) throw new NotFoundException('Space not found');
    await this.prisma.spaceSuggestionDismissal.createMany({
      data: [{ userId, spaceId }],
      skipDuplicates: true,
    });
    return { spaceId, dismissed: true };
  }

  /** Undo, from the toast that follows a dismissal. */
  async undismiss(userId: string, spaceId: string) {
    await this.prisma.spaceSuggestionDismissal.deleteMany({ where: { userId, spaceId } });
    return { spaceId, dismissed: false };
  }

  /* -------------------------------- signals -------------------------------- */

  /**
   * Everything the viewer did, summed per space and kind.
   *
   * Counted against the post's space, so a like counts towards the room the
   * post is in. A reshare counts towards the space of the post it passes on,
   * not the one it was reshared into. Removed posts and comments are left out:
   * engaging with something a moderator took down says nothing about wanting
   * to be there.
   *
   * Every COUNT is cast to int — a raw COUNT comes back as a BigInt, which
   * cannot be serialised to JSON.
   */
  private activity(userId: string): Promise<ActivityRow[]> {
    return this.prisma.$queryRaw<ActivityRow[]>`
      WITH ev AS (
        SELECT p.space_id, 'comment' AS kind, c.post_id AS item, c.created_at AS at, 1.0 AS w
          FROM post_comments c JOIN posts p ON p.id = c.post_id
         WHERE c.author_id = ${userId} AND c.removed_at IS NULL AND p.removed_at IS NULL
        UNION ALL
        SELECT p.space_id, 'post', p.id, p.created_at, 1.0
          FROM posts p
         WHERE p.author_id = ${userId} AND p.removed_at IS NULL AND p.reshared_from_id IS NULL
        UNION ALL
        SELECT o.space_id, 'reshare', o.id, r.created_at, 1.0
          FROM posts r JOIN posts o ON o.id = r.reshared_from_id
         WHERE r.author_id = ${userId} AND r.removed_at IS NULL AND o.removed_at IS NULL
        UNION ALL
        SELECT p.space_id, 'like', p.id, l.created_at, 1.0
          FROM post_likes l JOIN posts p ON p.id = l.post_id
         WHERE l.user_id = ${userId} AND p.removed_at IS NULL
        UNION ALL
        SELECT p.space_id, 'bookmark', p.id, b.created_at, 1.0
          FROM post_bookmarks b JOIN posts p ON p.id = b.post_id
         WHERE b.user_id = ${userId} AND p.removed_at IS NULL
        UNION ALL
        SELECT p.space_id, 'vote', v.poll_id, v.voted_at, 1.0
          FROM poll_votes v JOIN polls pl ON pl.id = v.poll_id JOIN posts p ON p.id = pl.post_id
         WHERE v.user_id = ${userId} AND p.removed_at IS NULL
        UNION ALL
        -- Once per tide and space: a tide announced twice in one space is
        -- still one tide. "Interested" counts half of "Going".
        SELECT DISTINCT ON (p.space_id, a.tide_id)
               p.space_id, 'tide', a.tide_id, a.created_at,
               CASE WHEN a.status = 'GOING' THEN 1.0 ELSE 0.5 END
          FROM tide_attendees a JOIN posts p ON p.tide_id = a.tide_id
         WHERE a.user_id = ${userId} AND p.removed_at IS NULL
      )
      SELECT space_id AS "spaceId",
             kind,
             COUNT(DISTINCT item)::int AS count,
             SUM(w * power(0.5, EXTRACT(EPOCH FROM (now() - at)) / (${HALF_LIFE_DAYS}::float8 * 86400)))::float8 AS recency
        FROM ev
       WHERE space_id IS NOT NULL
         AND at > now() - make_interval(days => ${LOOKBACK_DAYS}::int)
       GROUP BY space_id, kind`;
  }

  /**
   * Spaces joined by people who share a space with the viewer.
   *
   * GROUPING SETS gives both the count through each shared space and the
   * total per space in one pass; the total row is the one whose `via` is
   * null. Pairs below the minimum are dropped here rather than shipped back.
   */
  private peers(userId: string): Promise<PeerRow[]> {
    return this.prisma.$queryRaw<PeerRow[]>`
      WITH mine AS (
        SELECT m.space_id
          FROM space_members m JOIN spaces s ON s.id = m.space_id
         WHERE m.user_id = ${userId}
           AND s.archived_at IS NULL
           AND (SELECT COUNT(*) FROM space_members x WHERE x.space_id = m.space_id) <= ${MAX_PEER_SPACE_SIZE}::int
      ),
      peers AS (
        SELECT DISTINCT m.user_id, m.space_id AS via
          FROM space_members m JOIN mine ON mine.space_id = m.space_id
         WHERE m.user_id <> ${userId}
      )
      SELECT o.space_id AS "spaceId",
             p.via AS "viaSpaceId",
             COUNT(DISTINCT p.user_id)::int AS members
        FROM peers p JOIN space_members o ON o.user_id = p.user_id
       WHERE o.space_id NOT IN (SELECT space_id FROM space_members WHERE user_id = ${userId})
       GROUP BY GROUPING SETS ((o.space_id, p.via), (o.space_id))
      HAVING COUNT(DISTINCT p.user_id) >= ${MIN_SHARED_MEMBERS}::int`;
  }

  /** Skills, title and industry — whichever profile the person has. */
  private async profile(userId: string): Promise<ProfileTerms> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        jobSeekerProfile: { select: { skills: true, currentTitle: true, industry: true } },
        employerProfile: { select: { industry: true } },
      },
    });
    const seeker = user?.jobSeekerProfile;
    return {
      skills: seeker?.skills ?? [],
      title: seeker?.currentTitle ?? null,
      industry: seeker?.industry ?? user?.employerProfile?.industry ?? null,
    };
  }
}
