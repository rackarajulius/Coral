import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanyMemberStatus, CompanyRole, PostPurpose, Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import { MarketplaceService } from '../../marketplace/marketplace.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';
import { CompanyContextService } from '../../company/company-context.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CommunityIdentityService, AuthorIdentity } from '../identity.service';
import { CommunityMediaService } from '../media.service';
import { PollsService } from '../polls.service';
import { LinkPreviewService } from '../link-preview.service';
import { User } from '../../common/types/user.types';
import { AnnouncementReferenceDto, AnnouncementReferenceType, CommunityPostPurpose, CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';

type AnnouncementCard = Awaited<ReturnType<MarketplaceService['projectAnnouncementReference']>>;

/**
 * The community's sections, as post purposes.
 *
 * A question is talk, not an opportunity; a service announcement is on offer,
 * the same as an open project or a live job. Every purpose belongs to exactly
 * one section, so the three together are the whole feed.
 */
const SECTION_PURPOSES: Record<NonNullable<ListPostsQueryDto['section']>, PostPurpose[]> = {
  discussion: [PostPurpose.GENERAL, PostPurpose.QUESTION],
  showcase: [PostPurpose.SHOWCASE],
  opportunity: [PostPurpose.OPPORTUNITY, PostPurpose.SERVICE_ANNOUNCEMENT],
};

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: SpacesService,
    private readonly identity: CommunityIdentityService,
    private readonly media: CommunityMediaService,
    private readonly polls: PollsService,
    private readonly links: LinkPreviewService,
    private readonly companyContext: CompanyContextService,
    private readonly notifications: NotificationsService,
    private readonly marketplace?: MarketplaceService,
  ) {}

  async list(query: ListPostsQueryDto, currentUserId?: string) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    /**
     * The personal slices need to know who is asking.
     *
     * Signed out they resolve to nothing rather than silently falling back to
     * the whole feed — "Saved" showing every post on the platform would be a
     * lie about whose list it is.
     */
    const personal = await this.buildPersonalFilter(query.filter, currentUserId);
    if (personal === 'none') {
      return {
        data: [],
        meta: { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
      };
    }

    const where = {
      // Removed content is gone from every listing. It survives in the table
      // so a decision can be reviewed, not so it can keep being read.
      removedAt: null,
      ...personal,
      ...(query.spaceId ? { spaceId: query.spaceId } : {}),
      // A person's posts are what they said as themselves: what they published
      // in a company's name is the company's, and lives on its page.
      ...(query.authorId ? { authorId: query.authorId, companyId: null } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.query
        ? { content: { contains: query.query, mode: 'insensitive' as const } }
        : {}),
      ...(query.hashtag ? { hashtags: { has: query.hashtag.toLowerCase() } } : {}),
      ...(query.section ? { purpose: { in: SECTION_PURPOSES[query.section] } } : {}),
    };

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: this.buildPostInclude(),
        orderBy: this.buildOrder(query.sort),
        skip,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    const normalized = await this.withPolls(
      await this.withIdentity(await this.addViewerFlags(posts, currentUserId)),
      currentUserId,
    );

    return {
      data: normalized,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async getById(postId: string, currentUser?: User) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        ...this.buildPostInclude(),
        comments: {
          where: { parentId: null, removedAt: null },
          include: {
            author: {
              select: {
                id: true,
                displayName: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                role: true,
              },
            },
            replies: {
              where: { removedAt: null },
              include: {
                author: {
                  select: {
                    id: true,
                    displayName: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                    role: true,
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    // Removed content is retained for the moderation queue, not public permalinks.
    if (!post || post.removedAt) {
      throw new NotFoundException('Post not found');
    }

    const [normalized] = await this.withIdentity(await this.addViewerFlags([post], currentUser?.id));

    return {
      ...normalized,
      canEdit: normalized.canEdit || Boolean(currentUser?.role === 'ADMIN' && !post.companyId),
    };
  }

  /**
   * The company this person may post for, or null.
   *
   * Deliberately derived, never accepted from the request. Owners and admins
   * are the company's page admins; a recruiter or interviewer can post as
   * themselves — with the verified badge that already says where they work —
   * but cannot publish in the company's name.
   */
  async companyVoiceFor(userId: string): Promise<{ id: string; name: string } | null> {
    const context = await this.companyContext.forUser(userId);
    if (!context) return null;
    return CompanyContextService.canManageMembers(context.role)
      ? { id: context.companyId, name: context.companyName }
      : null;
  }

  private async selectedCompanyVoiceFor(userId: string, companyId?: string): Promise<{ id: string; name: string } | null> {
    if (companyId === undefined) return this.companyVoiceFor(userId);
    if (typeof companyId !== 'string' || !isUUID(companyId)) throw new BadRequestException('Choose a valid company.');
    const membership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: { role: true, status: true, user: { select: { status: true } }, company: { select: { id: true, name: true } } },
    });
    if (!membership || membership.status !== CompanyMemberStatus.ACTIVE || membership.user.status !== 'ACTIVE' ||
      !CompanyContextService.canManageMembers(membership.role)) {
      throw new ForbiddenException('Only a current company owner or admin can publish in its name.');
    }
    return membership.company;
  }

  async announcementOptions(userId: string, asCompany = false, selectedCompanyId?: string) {
    if (selectedCompanyId !== undefined && !asCompany) throw new BadRequestException('A company choice requires company publishing.');
    // Explicit choices are checked even while announcements are disabled.
    const selectedCompany = selectedCompanyId !== undefined ? await this.selectedCompanyVoiceFor(userId, selectedCompanyId) : null;
    if (!this.marketplace?.isListingWritesEnabled()) {
      return { services: [], projects: [], jobs: [] };
    }
    const companyId = asCompany ? (selectedCompany ?? await this.companyVoiceFor(userId))?.id : null;
    if (asCompany && !companyId) {
      throw new ForbiddenException('Only a current company owner or admin can announce its opportunities.');
    }
    return this.marketplace.getAnnouncementOptions(userId, companyId);
  }

  async create(userId: string, dto: CreatePostDto) {
    if (dto.companyId !== undefined && dto.asCompany !== true) throw new BadRequestException('A company choice requires company publishing.');
    this.assertPostContent(dto.content, dto.mediaUrls);
    // A space is optional; one that is named must exist and be open, refused
    // at the door rather than producing a post in a room that is gone.
    if (dto.spaceId) await this.spaces.assertPostable(dto.spaceId);
    // Refuses remote images: see CommunityMediaService for why an arbitrary
    // URL in a post is a tracking pixel with extra steps.
    this.media.assertOwnMedia(dto.mediaUrls ?? []);

    let companyId: string | null = null;
    if (dto.asCompany) {
      companyId = (await this.selectedCompanyVoiceFor(userId, dto.companyId))?.id ?? null;
      // Refused rather than quietly downgraded to a personal post: someone who
      // meant to publish as the company should not discover later that they
      // published as themselves.
      if (!companyId) {
        throw new ForbiddenException(
          'Only an owner or admin of a company can post in its name.',
        );
      }
    }

    const hashtags = this.normalizeHashtags(dto.hashtags ?? []);
    const contentHashtags = this.extractHashtags(dto.content);
    const mergedHashtags = Array.from(new Set([...hashtags, ...contentHashtags]));
    const purpose = dto.purpose ?? CommunityPostPurpose.GENERAL;
    this.assertPurposeReference(purpose, dto.reference);
    const postData = {
      authorId: userId,
      companyId,
      // None means everyone: Home, the author's followers, their profile or
      // the company's page.
      spaceId: dto.spaceId ?? null,
      content: dto.content?.trim() || '',
      postType: dto.poll ? 'POLL' as const : dto.postType || 'TEXT' as const,
      purpose: purpose.toUpperCase() as PostPurpose,
      mediaUrls: dto.mediaUrls ?? [],
      hashtags: mergedHashtags,
    };
    // Validate the canonical record within the same transaction as publication.
    const created = dto.reference
      ? await this.prisma.$transaction(async (tx) => {
          const referenceData = await this.validateReference(userId, dto.reference!, companyId, tx);
          return tx.post.create({ data: { ...postData, ...referenceData }, include: this.buildPostInclude() });
        })
      : await this.prisma.post.create({
      data: {
        ...postData,
      },
      include: this.buildPostInclude(),
    });

    /**
      * Created after the post, because the poll needs its id.
      *
      * If the options are invalid the post is removed rather than left behind:
      * a poll post with no poll is a dead card nobody can act on, and quietly
      * downgrading it to a plain post would publish something the author did
      * not write.
      */
    if (dto.poll) {
      try {
        await this.polls.createForPost(created.id, dto.poll);
      } catch (err) {
        await this.prisma.post.delete({ where: { id: created.id } });
        throw err;
      }
    }

    // Posting in a space is taking part in it, so the author joins — after the
    // post is safely written, so a refused post never leaves a membership
    // behind.
    if (dto.spaceId) await this.spaces.joinOnPost(userId, dto.spaceId);

    /**
      * Unfurled after the post exists, and never allowed to fail it.
      *
      * The fetch reaches a stranger's server, so it can be slow, wrong or
      * hostile. The post is already saved by the time this runs; a preview
      * that does not arrive costs a card, not the thing someone wrote.
      */
    const link = this.links.firstUrl(created.content);
    if (link && !dto.poll) {
      const preview = await this.links.build(link, userId);
      if (preview) {
        await this.prisma.post.update({
          where: { id: created.id },
          data: { linkPreview: preview as unknown as Prisma.InputJsonValue },
        });
        (created as { linkPreview?: unknown }).linkPreview = preview;
      }
    }

    const [normalized] = await this.addViewerFlags([created], userId);
    return {
      success: true,
      data: normalized,
      message: 'Post created successfully',
    };
  }

  async update(postId: string, currentUser: User, dto: UpdatePostDto) {
    const existing = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        companyId: true,
        content: true,
        mediaUrls: true,
        hashtags: true,
        purpose: true,
        linkedServiceListingId: true,
        linkedGigId: true,
        linkedJobId: true,
        tideId: true,
        removedAt: true,
      },
    });

    if (!existing || existing.removedAt) {
      throw new NotFoundException('Post not found');
    }

    if (!(await this.canManagePost(existing, currentUser))) {
      throw new ForbiddenException(existing.companyId
        ? 'Only a current owner or admin of this company can edit its post.'
        : 'You can only edit your own post');
    }

    const nextContent = dto.content !== undefined ? dto.content : existing.content;
    const nextMediaUrls = dto.mediaUrls !== undefined ? dto.mediaUrls : existing.mediaUrls;
    this.assertPostContent(nextContent, nextMediaUrls);
    if (dto.mediaUrls !== undefined) this.media.assertOwnMedia(nextMediaUrls ?? []);

    const purpose = dto.purpose ?? (existing.purpose ?? 'GENERAL').toLowerCase() as CommunityPostPurpose;
    const reference = dto.reference === undefined ? this.referenceOf(existing) : dto.reference;
    this.assertPurposeReference(purpose, reference);
    if (existing.tideId && (purpose !== CommunityPostPurpose.GENERAL || reference)) {
      throw new BadRequestException('Tide announcements retain their event purpose.');
    }

    const hashtags = this.normalizeHashtags(dto.hashtags ?? existing.hashtags);
    const contentHashtags = this.extractHashtags(nextContent);
    const mergedHashtags = Array.from(new Set([...hashtags, ...contentHashtags]));

    const updateData = {
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
        ...(dto.postType !== undefined ? { postType: dto.postType } : {}),
        ...(dto.mediaUrls !== undefined ? { mediaUrls: dto.mediaUrls } : {}),
        purpose: purpose.toUpperCase() as PostPurpose,
        linkedServiceListingId: null,
        linkedGigId: null,
        linkedJobId: null,
        hashtags: mergedHashtags,
        isEdited: true,
    };
    const updated = reference
      ? await this.prisma.$transaction(async (tx) => {
          const referenceData = await this.validateReference(currentUser.id, reference, existing.companyId, tx);
          return tx.post.update({ where: { id: postId }, data: { ...updateData, ...referenceData }, include: this.buildPostInclude() });
        })
      : await this.prisma.post.update({ where: { id: postId }, data: updateData, include: this.buildPostInclude() });

    const [normalized] = await this.addViewerFlags([updated], currentUser.id);
    return {
      success: true,
      data: normalized,
      message: 'Post updated successfully',
    };
  }

  async delete(postId: string, currentUser: User) {
    const existing = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, companyId: true },
    });

    if (!existing) {
      throw new NotFoundException('Post not found');
    }

    if (!(await this.canManagePost(existing, currentUser))) {
      throw new ForbiddenException(existing.companyId
        ? 'Only a current owner or admin of this company can delete its post.'
        : 'You can only delete your own post');
    }

    await this.prisma.post.delete({ where: { id: postId } });
    return {
      success: true,
      message: 'Post deleted successfully',
    };
  }

  /**
   * Passes a post on, optionally with your own words on top.
   *
   * The reshare is an ordinary post — it can be liked, commented on and
   * deleted like any other — that happens to carry the original inside it.
   * That keeps one set of rules for everything rather than a second kind of
   * object with its own half of the features.
   */
  async reshare(postId: string, userId: string, content?: string) {
    const original = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, spaceId: true, removedAt: true, resharedFromId: true },
    });

    if (!original || original.removedAt) {
      throw new NotFoundException('Post not found');
    }

    /**
     * Flattened, never chained.
     *
     * Resharing a reshare points at what was originally written. Without this
     * the embed would be a reshare of a reshare of a post, and the words
     * someone actually wrote would be several boxes down.
     */
    const targetId = original.resharedFromId ?? original.id;
    const target =
      targetId === original.id
        ? original
        : await this.prisma.post.findUnique({
            where: { id: targetId },
            select: { id: true, authorId: true, spaceId: true, removedAt: true, resharedFromId: true },
          });

    if (!target || target.removedAt) {
      throw new NotFoundException('Post not found');
    }

    const trimmed = content?.trim() || '';

    const created = await this.prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          authorId: userId,
          // The original's space, so a post stays in the room it belongs to
          // rather than being carried into an unrelated one.
          spaceId: target.spaceId,
          resharedFromId: target.id,
          content: trimmed,
          postType: 'TEXT',
        },
        include: this.buildPostInclude(),
      });

      await tx.post.update({
        where: { id: target.id },
        data: { resharesCount: { increment: 1 } },
      });

      return post;
    });

    // Being passed on is worth hearing about, and unlike a like it is rare
    // enough not to become noise.
    if (target.authorId !== userId) {
      void this.notifications.create({
        userId: target.authorId,
        type: 'community',
        title: `${await this.nameOf(userId)} shared your post`,
        message: trimmed || 'They passed it on without adding anything.',
        link: `/community/posts/${created.id}`,
      });
    }

    const [visible] = await this.addViewerFlags([created], userId);
    return { success: true, data: visible, message: 'Post shared' };
  }

  /** The display name for a notification line. */
  private async nameOf(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, firstName: true, lastName: true },
    });
    return (
      user?.displayName?.trim() ||
      [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
      'Someone'
    );
  }

  async like(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.postLike.findUnique({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      });

      if (existing) {
        return { created: false };
      }

      await tx.postLike.create({
        data: { postId, userId },
      });

      await tx.post.update({
        where: { id: postId },
        data: { likesCount: { increment: 1 } },
      });

      return { created: true };
    });

    return {
      success: true,
      data: {
        liked: true,
        changed: result.created,
      },
    };
  }

  async unlike(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.postLike.findUnique({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      });

      if (!existing) {
        return { removed: false };
      }

      await tx.postLike.delete({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      });

      await tx.post.update({
        where: { id: postId },
        data: { likesCount: { decrement: 1 } },
      });

      return { removed: true };
    });

    return {
      success: true,
      data: {
        liked: false,
        changed: result.removed,
      },
    };
  }

  async bookmark(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.postBookmark.findUnique({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      });

      if (existing) {
        return { created: false };
      }

      await tx.postBookmark.create({
        data: { postId, userId },
      });

      await tx.post.update({
        where: { id: postId },
        data: { bookmarksCount: { increment: 1 } },
      });

      return { created: true };
    });

    return {
      success: true,
      data: {
        bookmarked: true,
        changed: result.created,
      },
    };
  }

  async unbookmark(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.postBookmark.findUnique({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      });

      if (!existing) {
        return { removed: false };
      }

      await tx.postBookmark.delete({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      });

      await tx.post.update({
        where: { id: postId },
        data: { bookmarksCount: { decrement: 1 } },
      });

      return { removed: true };
    });

    return {
      success: true,
      data: {
        bookmarked: false,
        changed: result.removed,
      },
    };
  }

  /**
   * How the feed is ordered.
   *
   * "top" is engagement-weighted but still time-bounded, so a good post from
   * three months ago does not sit permanently above today's question. It is
   * deliberately not a personalised or outrage-weighted ranking: on a platform
   * where a recruiter may read what you wrote, rewarding heat would cost
   * people jobs.
   */
  /**
   * Turns a named slice into a where-clause fragment.
   *
   * Returns 'none' when the slice is meaningless for this caller — signed out,
   * or in no spaces — so the caller can answer with an empty list instead of
   * quietly widening the query.
   */
  private async buildPersonalFilter(
    filter: string | undefined,
    userId?: string,
  ): Promise<Record<string, unknown> | 'none'> {
    if (!filter) return {};
    if (!userId) return 'none';

    switch (filter) {
      case 'mine':
        return { authorId: userId };
      case 'saved':
        return { bookmarks: { some: { userId } } };
      case 'liked':
        return { likes: { some: { userId } } };
      case 'my-spaces': {
        const memberships = await this.prisma.spaceMember.findMany({
          where: { userId, space: { archivedAt: null } },
          select: { spaceId: true },
        });
        // Joining nothing is a real state, and showing the global feed instead
        // would make the tab meaningless the moment someone leaves a space.
        if (memberships.length === 0) return 'none';
        return { spaceId: { in: memberships.map((m) => m.spaceId) } };
      }
      case 'following': {
        /**
         * What the people and companies you follow have posted.
         *
         * A person is followed for what they say as themselves, so their
         * posts in a company's name are left to the company; a company is
         * followed through its page, so its posts arrive whoever wrote them.
         * The same two Follow buttons the post card shows.
         */
        const [people, companies] = await Promise.all([
          this.prisma.userFollow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
          this.prisma.companyFollow.findMany({
            where: { userId },
            select: { company: { select: { companyId: true } } },
          }),
        ]);
        const peopleIds = people.map((f) => f.followingId);
        const companyIds = [...new Set(companies.flatMap((f) => (f.company.companyId ? [f.company.companyId] : [])))];
        // Following nobody is a real state; the whole feed in its place would
        // make the tab look like it did something.
        if (peopleIds.length === 0 && companyIds.length === 0) return 'none';
        return {
          OR: [
            ...(peopleIds.length ? [{ authorId: { in: peopleIds }, companyId: null }] : []),
            ...(companyIds.length ? [{ companyId: { in: companyIds } }] : []),
          ],
        };
      }
      default:
        return {};
    }
  }

  private buildOrder(sort?: string) {
    if (sort === 'top') {
      return [
        { likesCount: 'desc' as const },
        { commentsCount: 'desc' as const },
        { createdAt: 'desc' as const },
      ];
    }
    return [{ createdAt: 'desc' as const }];
  }

  private buildPostInclude() {
    return {
      space: { select: { id: true, slug: true, name: true } },
      // Present only on posts published in a company's name. The author is
      // still included alongside it — see the byline in FeedPost.
      company: { select: { id: true, name: true, profiles: {
        where: { visibility: { not: 'private' } }, select: { id: true },
        orderBy: { createdAt: 'asc' as const }, take: 1,
      } } },
      /**
       * The post being passed on, embedded.
       *
       * One level only, which is why reshares are flattened on creation —
       * nesting this include would mean a query whose depth depends on how
       * many times something has been passed around.
       */
      resharedFrom: {
        select: {
          id: true,
          content: true,
          mediaUrls: true,
          postType: true,
          purpose: true,
          linkedServiceListingId: true,
          linkedGigId: true,
          linkedJobId: true,
          createdAt: true,
          removedAt: true,
          authorId: true,
          author: {
            select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true, role: true, createdAt: true },
          },
          company: { select: { id: true, name: true, profiles: {
            where: { visibility: { not: 'private' } }, select: { id: true },
            orderBy: { createdAt: 'asc' as const }, take: 1,
          } } },
          space: { select: { id: true, slug: true, name: true } },
        },
      },
      author: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          likes: true,
          comments: true,
          bookmarks: true,
          reshares: true,
        },
      },
    };
  }

  /**
   * Attaches how each author is presented.
   *
   * Resolved at read time rather than stored on the post: a badge is a claim
   * about who someone is *now*, and someone who leaves a company should stop
   * speaking for it on posts they wrote last year.
   */
  /**
   * Attaches each poll as the viewer should see it.
   *
   * Done per post rather than in the include, because what comes back depends
   * on whether *this* reader has voted — a shared include cannot express that.
   */
  private async withPolls<T extends { id: string; postType: string }>(
    posts: T[],
    userId?: string,
  ) {
    const pollPosts = posts.filter((p) => p.postType === 'POLL');
    if (pollPosts.length === 0) return posts.map((p) => ({ ...p, poll: null }));

    const byPost = new Map(
      await Promise.all(
        pollPosts.map(async (p) => [p.id, await this.polls.forViewer(p.id, userId)] as const),
      ),
    );
    return posts.map((p) => ({ ...p, poll: byPost.get(p.id) ?? null }));
  }

  private async withIdentity<T extends { authorId: string }>(posts: T[]) {
    if (posts.length === 0) return posts as Array<T & { authorIdentity: AuthorIdentity }>;
    const identities = await this.identity.resolve(posts.map((p) => p.authorId));
    return posts.map((post) => ({
      ...post,
      authorIdentity: identities.get(post.authorId)!,
    }));
  }

  private async addViewerFlags<T extends { id: string; authorId?: string; companyId?: string | null }>(
    posts: T[],
    currentUserId?: string,
  ): Promise<Array<T & { likedByMe: boolean; bookmarkedByMe: boolean; canEdit: boolean; linkedRecord: AnnouncementCard; linkedRecordUnavailable: boolean }>> {
    // A live reshare may outlast its removed source. Retain the sharer's words,
    // but do not serialize the removed original into any ordinary read payload.
    const visiblePosts = await this.withLinkedRecords(posts.map((post) => {
      const source = (post as T & { resharedFrom?: { removedAt?: Date | null } }).resharedFrom;
      return source?.removedAt ? { ...post, resharedFrom: null } : post;
    }));

    if (!currentUserId || posts.length === 0) {
      return visiblePosts.map((post) => ({
        ...post,
        likedByMe: false,
        bookmarkedByMe: false,
        canEdit: false,
      }));
    }

    const postIds = posts.map((post) => post.id);
    const companyIds = [...new Set(posts.flatMap((post) => post.companyId ? [post.companyId] : []))];
    const [likes, bookmarks, companySeats] = await Promise.all([
      this.prisma.postLike.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
        },
        select: { postId: true },
      }),
      this.prisma.postBookmark.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
        },
        select: { postId: true },
      }),
      // A page can contain many authors from the same company. Resolve the
      // viewer's current publishing seats once, rather than once per card.
      companyIds.length > 0
        ? this.prisma.companyMember.findMany({
            where: {
              userId: currentUserId,
              companyId: { in: companyIds },
              status: CompanyMemberStatus.ACTIVE,
              role: { in: [CompanyRole.OWNER, CompanyRole.ADMIN] },
            },
            select: { companyId: true },
          })
        : Promise.resolve([]),
    ]);

    const likedPostIds = new Set(likes.map((item) => item.postId));
    const bookmarkedPostIds = new Set(bookmarks.map((item) => item.postId));
    const managedCompanyIds = new Set(companySeats.map((seat) => seat.companyId));

    return visiblePosts.map((post) => ({
      ...post,
      likedByMe: likedPostIds.has(post.id),
      bookmarkedByMe: bookmarkedPostIds.has(post.id),
      canEdit: post.companyId
        ? managedCompanyIds.has(post.companyId)
        : post.authorId === currentUserId,
    }));
  }

  /** Company attribution survives a seat change; permission to act does not. */
  private async canManagePost(
    post: { authorId: string; companyId?: string | null },
    currentUser: User,
  ): Promise<boolean> {
    if (!post.companyId) {
      return post.authorId === currentUser.id || currentUser.role === 'ADMIN';
    }

    // Resolve this record's company directly. A caller may have an older,
    // removed membership elsewhere; that row cannot grant or deny this seat.
    const membership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: post.companyId, userId: currentUser.id } },
      select: { role: true, status: true },
    });
    return membership?.status === CompanyMemberStatus.ACTIVE &&
      CompanyContextService.canManageMembers(membership.role);
  }

  private assertPurposeReference(purpose: CommunityPostPurpose, reference?: AnnouncementReferenceDto | null) {
    if (purpose === CommunityPostPurpose.SERVICE_ANNOUNCEMENT || purpose === CommunityPostPurpose.OPPORTUNITY) {
      this.marketplace?.assertListingWritesEnabled();
      if (!this.marketplace) throw new ForbiddenException('Marketplace announcements are unavailable.');
    }
    if (purpose === CommunityPostPurpose.SERVICE_ANNOUNCEMENT && reference?.type !== AnnouncementReferenceType.SERVICE) {
      throw new BadRequestException('A service announcement must link to your published service.');
    }
    if (purpose === CommunityPostPurpose.OPPORTUNITY && ![AnnouncementReferenceType.PROJECT, AnnouncementReferenceType.JOB].includes(reference?.type as AnnouncementReferenceType)) {
      throw new BadRequestException('An opportunity must link to your published project brief or live job.');
    }
    if (reference && (purpose === CommunityPostPurpose.GENERAL || purpose === CommunityPostPurpose.QUESTION)) {
      throw new BadRequestException('Choose showcase, service announcement or opportunity to attach a listing.');
    }
    if (purpose === CommunityPostPurpose.SHOWCASE && reference && reference.type !== AnnouncementReferenceType.SERVICE) {
      throw new BadRequestException('A showcase can link to your published service.');
    }
  }

  private async validateReference(userId: string, reference: AnnouncementReferenceDto, companyId: string | null | undefined, tx: Prisma.TransactionClient) {
    if (!this.marketplace) throw new ForbiddenException('Marketplace announcements are unavailable.');
    this.marketplace.assertListingWritesEnabled();
    return this.marketplace.validateAnnouncementReference(userId, reference, companyId, tx);
  }

  private referenceOf(record: { linkedServiceListingId?: string | null; linkedGigId?: string | null; linkedJobId?: string | null }): AnnouncementReferenceDto | null {
    if (record.linkedServiceListingId) return { type: AnnouncementReferenceType.SERVICE, id: record.linkedServiceListingId };
    if (record.linkedGigId) return { type: AnnouncementReferenceType.PROJECT, id: record.linkedGigId };
    if (record.linkedJobId) return { type: AnnouncementReferenceType.JOB, id: record.linkedJobId };
    return null;
  }

  /** Canonical records are resolved once per distinct reference on every read. */
  private async withLinkedRecords<T extends { id: string }>(posts: T[]) {
    type LinkedFields = { purpose?: string; linkedServiceListingId?: string | null; linkedGigId?: string | null; linkedJobId?: string | null; resharedFrom?: ({ id: string } & LinkedFields) | null };
    const references = new Map<string, AnnouncementReferenceDto>();
    for (const post of posts) {
      for (const record of [post as T & LinkedFields, (post as T & LinkedFields).resharedFrom]) {
        const reference = record && this.referenceOf(record);
        if (reference) references.set(`${reference.type}:${reference.id}`, reference);
      }
    }
    const cards = new Map<string, AnnouncementCard>(await Promise.all([...references].map(async ([key, reference]) =>
      [key, this.marketplace ? await this.marketplace.projectAnnouncementReference(reference) : null] as const)));
    const project = <R extends { id: string } & LinkedFields>(record: R) => {
      const reference = this.referenceOf(record);
      const linkedRecord = reference ? cards.get(`${reference.type}:${reference.id}`) ?? null : null;
      return {
        ...record,
        purpose: (record.purpose ?? 'GENERAL').toLowerCase(),
        linkedRecord,
        linkedRecordUnavailable: Boolean(reference && !linkedRecord),
        // A stored unfurl must not revive withdrawn canonical details.
        ...(reference ? { linkPreview: null } : {}),
      };
    };
    return posts.map((post) => {
      const record = post as T & LinkedFields;
      return {
        ...project(record),
        ...(record.resharedFrom ? { resharedFrom: project(record.resharedFrom) } : {}),
      };
    });
  }

  private assertPostContent(content?: string, mediaUrls?: string[]) {
    const hasText = Boolean(content && content.trim().length > 0);
    const hasMedia = Boolean(mediaUrls && mediaUrls.length > 0);

    if (!hasText && !hasMedia) {
      throw new BadRequestException('A post requires content or media');
    }
  }

  private normalizeHashtags(hashtags: string[]): string[] {
    const normalized = hashtags
      .map((tag) => tag.trim().replace(/^#+/, '').toLowerCase())
      .filter(Boolean)
      .map((tag) => tag.slice(0, 50));

    return Array.from(new Set(normalized));
  }

  private extractHashtags(content?: string): string[] {
    if (!content) {
      return [];
    }

    const matches = content.match(/#([a-zA-Z0-9_]+)/g) || [];
    return this.normalizeHashtags(matches);
  }
}
