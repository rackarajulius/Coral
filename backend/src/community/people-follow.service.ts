import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommunityIdentityService } from './identity.service';
import { personName } from '../common/person-name';

/**
 * A post's words as a one-line reminder of it: mentions as "@Name", cut at
 * 120 characters. (Not imported from mentions.ts, which imports from here.)
 */
function postExcerpt(content: string, max = 120): string {
  const flat = content
    .replace(/@\[([^\[\]\n]{1,120})\]\((?:person|company):[0-9a-f-]{36}\)/gi, '@$1')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** Accounts that are not followable, and whose follows do not count. */
export const HIDDEN_STATUSES: UserStatus[] = [UserStatus.INACTIVE, UserStatus.SUSPENDED, UserStatus.BANNED];

/** The notification type the bell and the notifications page label "New follower". */
export const FOLLOW_NOTIFICATION = 'follow';

/** How long one follower's "followed you" stands before another may be sent. */
const RENOTIFY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export interface PersonFollowStatus {
  isFollowing: boolean;
  followerCount: number;
}

/**
 * People following people.
 *
 * The same shape as company follows — follow, unfollow, and a status that
 * carries the follower count — so the two Follow buttons in the community
 * behave alike. Idempotent both ways: following twice or unfollowing someone
 * you do not follow leaves things as they were.
 */
@Injectable()
export class PeopleFollowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly identity: CommunityIdentityService,
  ) {}

  /**
   * Whether the viewer follows this person, and how many people do.
   *
   * Public: the count is shown to everyone. Accounts that are closed,
   * suspended or banned are not counted, so a ban does not leave a number
   * behind that nobody can see the people of.
   */
  async status(viewerId: string | null, personId: string): Promise<PersonFollowStatus> {
    await this.assertFollowable(personId);
    const [mine, followerCount] = await Promise.all([
      viewerId
        ? this.prisma.userFollow.findUnique({
            where: { followerId_followingId: { followerId: viewerId, followingId: personId } },
            select: { id: true },
          })
        : Promise.resolve(null),
      this.prisma.userFollow.count({
        where: { followingId: personId, follower: { status: { notIn: HIDDEN_STATUSES } } },
      }),
    ]);
    return { isFollowing: !!mine, followerCount };
  }

  /**
   * What the community shows at the top of someone's page.
   *
   * Only for people who have taken part — a post or a reply that is still up.
   * Anyone else is "not found", the same answer as a closed or suspended
   * account, so the page cannot be used to put a name to an account id.
   * Nothing here goes beyond what their posts already show: the name and photo
   * on the byline, the line under it, and the counts. Their career profile is
   * linked only when it is public (`identity.profileUrl`), never copied in.
   */
  async card(viewerId: string | null, personId: string) {
    const person = await this.prisma.user.findUnique({
      where: { id: personId },
      select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true, role: true, status: true, createdAt: true },
    });
    if (!person || HIDDEN_STATUSES.includes(person.status)) throw new NotFoundException('Person not found');

    const [postCount, replyCount] = await Promise.all([
      // The same posts as the list on the page: their own voice, and posts
      // they accepted to collaborate on.
      this.prisma.post.count({
        where: {
          removedAt: null,
          OR: [
            { authorId: personId, companyId: null },
            { collaborators: { some: { userId: personId, status: 'ACCEPTED' } } },
          ],
        },
      }),
      this.prisma.postComment.count({ where: { authorId: personId, removedAt: null } }),
    ]);
    if (postCount === 0 && replyCount === 0) throw new NotFoundException('Person not found');

    const [identity, follow, followingPeople, followingCompanies, followedBy] = await Promise.all([
      this.identity.resolveOne(personId),
      this.status(viewerId, personId),
      this.prisma.userFollow.count({
        where: { followerId: personId, following: { status: { notIn: HIDDEN_STATUSES } } },
      }),
      this.prisma.companyFollow.count({ where: { userId: personId } }),
      this.followedByPeopleYouFollow(viewerId, personId),
    ]);

    return {
      id: person.id,
      displayName: person.displayName,
      firstName: person.firstName,
      lastName: person.lastName,
      avatarUrl: person.avatarUrl,
      role: person.role,
      identity,
      followerCount: follow.followerCount,
      isFollowing: follow.isFollowing,
      // People and companies alike: both arrive in their Following feed.
      followingCount: followingPeople + followingCompanies,
      postCount,
      replyCount,
      // When their account was made: how long someone has been around is
      // part of judging what they say.
      joinedAt: person.createdAt,
      followedBy,
    };
  }

  /**
   * "Followed by Ada, Ben and 3 others you follow": people the viewer follows
   * who follow this person — the three most recent by name, and how many in
   * all. Only ever people the viewer already chose to follow, so it says
   * nothing about strangers. Null signed out, or on your own page.
   */
  async followedByPeopleYouFollow(viewerId: string | null, personId: string) {
    if (!viewerId || viewerId === personId) return null;
    const where = {
      followingId: personId,
      followerId: { not: viewerId },
      follower: { status: { notIn: HIDDEN_STATUSES }, followers: { some: { followerId: viewerId } } },
    };
    const [recent, total] = await Promise.all([
      this.prisma.userFollow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { follower: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true } } },
      }),
      this.prisma.userFollow.count({ where }),
    ]);
    return {
      total,
      people: recent.map(({ follower }) => ({ id: follower.id, name: personName(follower, 'Someone'), avatarUrl: follower.avatarUrl ?? null })),
    };
  }

  /**
   * Their replies, newest first: what they said and on whose post, for the
   * Replies tab. Only replies still up, on posts still up.
   */
  async replies(personId: string, page = 1, limit = 20) {
    const person = await this.prisma.user.findUnique({ where: { id: personId }, select: { status: true } });
    if (!person || HIDDEN_STATUSES.includes(person.status)) throw new NotFoundException('Person not found');
    const take = Math.min(Math.max(limit, 1), 50);
    const where = { authorId: personId, removedAt: null, post: { removedAt: null } };
    const [rows, total] = await Promise.all([
      this.prisma.postComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Math.max(page, 1) - 1) * take,
        take,
        select: {
          id: true,
          content: true,
          createdAt: true,
          parentId: true,
          post: {
            select: {
              id: true,
              content: true,
              documentTitle: true,
              mediaUrls: true,
              author: { select: { displayName: true, firstName: true, lastName: true } },
              company: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.postComment.count({ where }),
    ]);
    return {
      data: rows.map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt,
        isReplyToComment: !!r.parentId,
        post: {
          id: r.post.id,
          by: r.post.company?.name ?? personName(r.post.author, 'Someone'),
          // A line to know the post by: its words, or what it carries.
          excerpt: postExcerpt(r.post.content)
            || r.post.documentTitle
            || (r.post.mediaUrls.length ? 'A post with pictures or video' : ''),
        },
      })),
      meta: { page: Math.max(page, 1), limit: take, total, totalPages: Math.max(Math.ceil(total / take), 1) },
    };
  }

  async follow(viewerId: string, personId: string): Promise<PersonFollowStatus> {
    if (viewerId === personId) throw new BadRequestException('You cannot follow yourself.');
    await this.assertFollowable(personId);
    // A duplicate is skipped rather than raised, and the count says whether
    // this click made a new follow — only a new one is news to anybody.
    const { count } = await this.prisma.userFollow.createMany({
      data: [{ followerId: viewerId, followingId: personId }],
      skipDuplicates: true,
    });
    if (count > 0) await this.announce(viewerId, personId);
    return this.status(viewerId, personId);
  }

  /**
   * Tells someone they have a new follower.
   *
   * Once a week per follower at most: unfollowing and following again is one
   * click each, and a bell that rings every time is a way to pester someone,
   * not news. Links to the follower's profile only where there is a public
   * one to see — the same rule the post cards use. Never blocks the follow:
   * the notifications service swallows its own failures.
   */
  private async announce(followerId: string, personId: string): Promise<void> {
    const [follower, identity] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: followerId },
        select: { displayName: true, firstName: true, lastName: true },
      }),
      this.identity.resolveOne(followerId),
    ]);
    const who = personName(follower, 'Someone');
    const title = `${who} followed you`;

    const recent = await this.prisma.notification.findFirst({
      where: {
        userId: personId,
        type: FOLLOW_NOTIFICATION,
        title,
        createdAt: { gte: new Date(Date.now() - RENOTIFY_AFTER_MS) },
      },
      select: { id: true },
    });
    if (recent) return;

    await this.notifications.create({
      userId: personId,
      type: FOLLOW_NOTIFICATION,
      title,
      message: identity.label
        ? `${identity.label}. Your posts now reach their Following feed.`
        : 'Your posts now reach their Following feed.',
      link: identity.profileUrl ?? undefined,
    });
  }

  async unfollow(viewerId: string, personId: string): Promise<PersonFollowStatus> {
    await this.prisma.userFollow.deleteMany({ where: { followerId: viewerId, followingId: personId } });
    return this.status(viewerId, personId);
  }

  /** Refuses people who do not exist or cannot be seen, with one answer for both. */
  private async assertFollowable(personId: string): Promise<void> {
    const person = await this.prisma.user.findUnique({ where: { id: personId }, select: { status: true } });
    if (!person || HIDDEN_STATUSES.includes(person.status)) {
      throw new NotFoundException('Person not found');
    }
  }
}
