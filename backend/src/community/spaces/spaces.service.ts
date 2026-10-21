import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../../common/scheduling/exclusive-cron';
import { Prisma, SpaceKind, SpaceMemberRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '../../common/types/user.types';
import { CommunityMediaService } from '../media.service';

/**
 * Where a pseudonym stops being a disclosure.
 *
 * Deliberately the same number the fairness module uses to decide whether a
 * group is large enough to report on: below it, "a verified engineer at X"
 * names one person as surely as their badge would.
 */
export const MIN_MEMBERS_FOR_ANONYMITY = 10;

export const SPACE_SCOPES = ['mine', 'popular', 'suggested', 'all'] as const;
export type SpaceScope = (typeof SPACE_SCOPES)[number];

/** How long a new space has to attract a post before it is retired. */
const ABANDONED_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Slugs the router or a future page already owns.
 *
 * `/community/moderation` exists today; the rest are the obvious next ones.
 * Letting a space take one would shadow a real page.
 */
const RESERVED_SLUGS = [
  'moderation', 'new', 'all', 'me', 'admin', 'search', 'settings',
  'about', 'help', 'spaces', 'saved', 'liked',
  // `GET /community/spaces/suggestions` is declared before `:slug`, so a
  // space with this slug could never be opened.
  'suggestions',
];

/**
 * Spaces — the places posts belong to.
 *
 * Anyone signed in may start one. The risk in that is a long list of empty
 * rooms — the exact failure spaces exist to prevent — so it is answered by
 * design rather than by refusing: duplicates are rejected at the slug, the
 * creator becomes its moderator, and one that attracts nothing is retired
 * automatically. See `create` and `sweepAbandoned`.
 */
@Injectable()
export class SpacesService {
  private readonly logger = new Logger(SpacesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: CommunityMediaService,
  ) {}

  /**
   * Spaces, in one of three slices.
   *
   * - `mine`: what the caller joined. The sidebar's list, so its length is
   *   bounded by one person's choices rather than by the size of the platform
   *   — the thing that keeps it usable at a thousand spaces.
   * - `popular`: the few most active, for someone who has joined nothing yet
   *   (or is signed out) and would otherwise see an empty section.
   * - `suggested`: everything the caller has *not* joined, busiest first —
   *   the search page's starting list. Signed out, that is simply everything.
   * - `all`: every space — searchable and paged.
   *
   * Busiest first rather than alphabetical: at scale "Accounting" sitting above
   * the space everyone uses is the list working against its readers. `mine`
   * stays alphabetical, because your own list reordering itself every time
   * someone else posts is disorienting.
   */
  async list(
    userId: string | undefined,
    opts: { scope?: SpaceScope; q?: string; page?: number; limit?: number } = {},
  ) {
    const scope = opts.scope ?? 'all';
    const page = Math.max(opts.page ?? 1, 1);
    const limit = Math.min(Math.max(opts.limit ?? (scope === 'popular' ? 8 : 24), 1), 50);
    const q = opts.q?.trim();

    // Signed out, "mine" is a list of nothing — answered as such rather than
    // quietly widening to everything.
    if (scope === 'mine' && !userId) {
      return { data: [], meta: { page, limit, total: 0, totalPages: 1 } };
    }

    const where: Prisma.SpaceWhereInput = {
      archivedAt: null,
      ...(scope === 'mine' ? { members: { some: { userId } } } : {}),
      // Suggesting a space you are already in wastes the slot.
      ...(scope === 'suggested' && userId ? { members: { none: { userId } } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.SpaceOrderByWithRelationInput[] =
      scope === 'mine'
        ? [{ name: 'asc' }]
        : [{ members: { _count: 'desc' } }, { posts: { _count: 'desc' } }, { name: 'asc' }];

    const [spaces, total] = await Promise.all([
      this.prisma.space.findMany({
        where,
        orderBy,
        skip: scope === 'popular' ? 0 : (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { members: true, posts: true } },
          company: { select: { id: true, name: true } },
        },
      }),
      scope === 'popular' ? Promise.resolve(0) : this.prisma.space.count({ where }),
    ]);

    // Membership for just this page, not for every space the caller joined.
    const mine = userId
      ? new Set(
          (
            await this.prisma.spaceMember.findMany({
              where: { userId, spaceId: { in: spaces.map((s) => s.id) } },
              select: { spaceId: true },
            })
          ).map((m) => m.spaceId),
        )
      : new Set<string>();

    return {
      data: spaces.map((s) => this.shape(s, mine.has(s.id))),
      meta: {
        page,
        limit,
        total: scope === 'popular' ? spaces.length : total,
        totalPages: scope === 'popular' ? 1 : Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  /**
   * One space, for its own page.
   *
   * Returns more than `list` does — who runs it, when it started, and what the
   * caller's standing is — because a page has room for the things that decide
   * whether someone joins, and a sidebar row does not.
   */
  async getBySlug(slug: string, userId?: string) {
    const space = await this.prisma.space.findUnique({
      where: { slug },
      include: {
        _count: { select: { members: true, posts: true } },
        company: { select: { id: true, name: true } },
        members: {
          where: { role: SpaceMemberRole.MODERATOR },
          take: 5,
          select: {
            user: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });
    if (!space || space.archivedAt) throw new NotFoundException('Space not found');

    const membership = userId
      ? await this.prisma.spaceMember.findUnique({
          where: { spaceId_userId: { spaceId: space.id, userId } },
          select: { role: true },
        })
      : null;

    return {
      ...this.shape(space, !!membership),
      createdAt: space.createdAt,
      /** Null when not a member; drives whether the banner can be changed. */
      myRole: membership?.role ?? null,
      moderators: space.members.map((m) => ({
        id: m.user.id,
        name:
          m.user.displayName?.trim() ||
          [m.user.firstName, m.user.lastName].filter(Boolean).join(' ').trim() ||
          'Member',
        avatarUrl: m.user.avatarUrl,
      })),
    };
  }

  /**
   * Sets the header image.
   *
   * Moderators of that space only. The file itself goes through the same
   * upload path as post media, so it is byte-checked and lands in our own
   * bucket rather than being a URL somebody pasted.
   */
  async setBanner(user: User, spaceId: string, bannerUrl: string | null) {
    await this.requireModerator(user, spaceId);
    // A banner is loaded by everyone who opens the space, so a foreign URL
    // here would report each of them to whoever owns it — and could be
    // swapped for something else after the fact.
    if (bannerUrl) this.media.assertOwnMedia([bannerUrl]);
    const space = await this.prisma.space.update({
      where: { id: spaceId },
      data: { bannerUrl },
      select: { id: true, bannerUrl: true },
    });
    return space;
  }

  private async requireModerator(user: User, spaceId: string) {
    const membership = await this.prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId, userId: user.id } },
      select: { role: true },
    });
    if (membership?.role !== SpaceMemberRole.MODERATOR) {
      throw new ForbiddenException('Only a moderator of this space can do that.');
    }
  }

  /**
   * Creates a space.
   *
   * Open creation risks a long list of empty rooms, which is the exact failure
   * spaces exist to prevent. Three things stop that rather than a rule saying
   * nobody may try: near-duplicate names are refused so an audience is not
   * split in two, the creator joins as its moderator so somebody is
   * responsible for it, and `sweepAbandoned` retires the ones that never got
   * going.
   */
  async create(user: User, input: { name: string; description?: string; bannerUrl?: string }) {
    const name = input.name.trim().replace(/\s+/g, ' ');
    if (name.length < 3 || name.length > 60) {
      throw new BadRequestException('A space name is between 3 and 60 characters.');
    }

    if (input.bannerUrl) this.media.assertOwnMedia([input.bannerUrl]);

    const slug = this.slugify(name);
    if (!slug) {
      throw new BadRequestException('That name needs at least a few letters or numbers.');
    }
    if (RESERVED_SLUGS.includes(slug)) {
      throw new BadRequestException('That name is reserved. Try another.');
    }

    /**
     * Compared on the slug, not the name.
     *
     * "Front End", "front-end" and "FrontEnd" all reduce to the same thing,
     * and three spaces for one subject is worse than none — everyone posts in
     * a different room and each looks dead.
     */
    const clash = await this.prisma.space.findUnique({
      where: { slug },
      select: { slug: true, name: true, archivedAt: true },
    });
    if (clash) {
      throw new BadRequestException(
        clash.archivedAt
          ? `"${clash.name}" existed before and was retired. Ask an admin to bring it back.`
          : `"${clash.name}" already covers that. Post there instead.`,
      );
    }

    const space = await this.prisma.space.create({
      data: {
        slug,
        name,
        description: input.description?.trim() || null,
        bannerUrl: input.bannerUrl ?? null,
        kind: SpaceKind.TOPIC,
        createdById: user.id,
        // Never zero-member, and never unowned.
        members: { create: { userId: user.id, role: SpaceMemberRole.MODERATOR } },
      },
      include: {
        _count: { select: { members: true, posts: true } },
        company: { select: { id: true, name: true } },
      },
    });

    return this.shape(space, true);
  }

  /**
   * Retires spaces that never started.
   *
   * The honest answer to open creation: a room with no posts and only the
   * person who made it is not a community, and leaving it on the list makes
   * every other space look emptier by association. Archived rather than
   * deleted, so the name is not immediately reusable by someone else.
   */
  @ExclusiveCron(CronExpression.EVERY_DAY_AT_4AM, { name: 'space-abandonment' })
  async sweepAbandoned(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS);
      const stale = await this.prisma.space.findMany({
        where: {
          archivedAt: null,
          kind: SpaceKind.TOPIC,
          // Seeded spaces have no creator and are never swept.
          createdById: { not: null },
          createdAt: { lt: cutoff },
          posts: { none: {} },
        },
        select: { id: true, name: true, _count: { select: { members: true } } },
      });

      // One member is the creator alone. Two people waiting is a start.
      const abandoned = stale.filter((s) => s._count.members <= 1);
      if (abandoned.length === 0) return;

      await this.prisma.space.updateMany({
        where: { id: { in: abandoned.map((s) => s.id) } },
        data: { archivedAt: new Date() },
      });
      this.logger.log(`Archived ${abandoned.length} space(s) with no activity.`);
    } catch (err) {
      this.logger.error(`Space sweep failed: ${(err as Error).message}`);
    }
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFKD')
      // Strips the combining marks NFKD just separated out, so "Café" and
      // "Cafe" land on the same slug rather than two rooms for one subject.
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  /**
   * Joining is idempotent.
   *
   * Someone tapping Join twice means the same thing both times, and treating
   * the second as a conflict would be the interface arguing with them.
   */
  async join(user: User, spaceId: string) {
    await this.requireLiveSpace(spaceId);
    await this.prisma.spaceMember.upsert({
      where: { spaceId_userId: { spaceId, userId: user.id } },
      create: { spaceId, userId: user.id },
      update: {},
    });
    return { spaceId, joined: true };
  }

  async leave(user: User, spaceId: string) {
    await this.prisma.spaceMember.deleteMany({ where: { spaceId, userId: user.id } });
    return { spaceId, joined: false };
  }

  /** The spaces this person is in — the basis of their home feed. */
  async mySpaceIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.spaceMember.findMany({
      where: { userId, space: { archivedAt: null } },
      select: { spaceId: true },
    });
    return rows.map((r) => r.spaceId);
  }

  /**
   * Checks a space exists and accepts posts.
   *
   * Called before writing a post so an archived or invented space id is
   * refused at the door rather than producing an orphaned post.
   */
  async assertPostable(spaceId: string): Promise<void> {
    await this.requireLiveSpace(spaceId);
  }

  /**
   * Makes someone who just posted in a space a member of it.
   *
   * LinkedIn refuses to let a non-member post in a group at all; joining on
   * the way in reaches the same place with one step fewer, and means the post
   * and its replies show up in their "My spaces" from then on. An existing
   * member, moderators included, is left exactly as they were.
   */
  async joinOnPost(userId: string, spaceId: string): Promise<void> {
    await this.prisma.spaceMember.upsert({
      where: { spaceId_userId: { spaceId, userId } },
      create: { spaceId, userId },
      update: {},
    });
  }

  /* --------------------------------- helpers -------------------------------- */

  private async requireLiveSpace(spaceId: string) {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: { id: true, archivedAt: true },
    });
    if (!space) throw new NotFoundException('Space not found');
    if (space.archivedAt) {
      throw new BadRequestException('That space has been archived.');
    }
    return space;
  }

  /** The one shape a space is listed in, wherever it is listed. */
  shape(
    space: {
      id: string;
      slug: string;
      name: string;
      description: string | null;
      kind: SpaceKind;
      allowAnonymous: boolean;
      bannerUrl: string | null;
      company: { id: string; name: string } | null;
      _count: { members: number; posts: number };
    },
    joined: boolean,
  ) {
    return {
      id: space.id,
      slug: space.slug,
      name: space.name,
      description: space.description,
      /** Doubles as the row thumbnail in lists; null shows an initial instead. */
      bannerUrl: space.bannerUrl,
      kind: space.kind,
      company: space.company,
      memberCount: space._count.members,
      postCount: space._count.posts,
      joined,
      /**
       * Reported rather than assumed by the client: anonymity needs both the
       * space to allow it and enough members for it to mean anything, and only
       * the server knows the second.
       */
      anonymityAvailable:
        space.allowAnonymous && space._count.members >= MIN_MEMBERS_FOR_ANONYMITY,
    };
  }
}
