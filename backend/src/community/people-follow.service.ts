import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommunityIdentityService } from './identity.service';

/** Accounts that are not followable, and whose follows do not count. */
const HIDDEN_STATUSES: UserStatus[] = [UserStatus.INACTIVE, UserStatus.SUSPENDED, UserStatus.BANNED];

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
      select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true, role: true, status: true },
    });
    if (!person || HIDDEN_STATUSES.includes(person.status)) throw new NotFoundException('Person not found');

    const [postCount, replyCount] = await Promise.all([
      // Their own voice only, the same as the list of posts on the page.
      this.prisma.post.count({ where: { authorId: personId, removedAt: null, companyId: null } }),
      this.prisma.postComment.count({ where: { authorId: personId, removedAt: null } }),
    ]);
    if (postCount === 0 && replyCount === 0) throw new NotFoundException('Person not found');

    const [identity, follow, followingPeople, followingCompanies] = await Promise.all([
      this.identity.resolveOne(personId),
      this.status(viewerId, personId),
      this.prisma.userFollow.count({
        where: { followerId: personId, following: { status: { notIn: HIDDEN_STATUSES } } },
      }),
      this.prisma.companyFollow.count({ where: { userId: personId } }),
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
    // Names first, as everywhere a person is named: a display name can be a
    // handle or an email's local part, which is not what anyone is called.
    const who =
      [follower?.firstName, follower?.lastName].filter(Boolean).join(' ').trim() ||
      follower?.displayName?.trim() ||
      'Someone';
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
