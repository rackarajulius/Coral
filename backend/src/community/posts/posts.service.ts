import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';
import { CompanyContextService } from '../../company/company-context.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CommunityIdentityService, AuthorIdentity } from '../identity.service';
import { CommunityMediaService } from '../media.service';
import { PollsService } from '../polls.service';
import { LinkPreviewService } from '../link-preview.service';
import { User } from '../../common/types/user.types';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';

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
      ...(query.authorId ? { authorId: query.authorId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.query
        ? { content: { contains: query.query, mode: 'insensitive' as const } }
        : {}),
      ...(query.hashtag ? { hashtags: { has: query.hashtag.toLowerCase() } } : {}),
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
          where: { parentId: null },
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

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const [normalized] = await this.addViewerFlags([post], currentUser?.id);

    return {
      ...normalized,
      canEdit: Boolean(
        currentUser && (currentUser.id === post.authorId || currentUser.role === 'ADMIN'),
      ),
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

  async create(userId: string, dto: CreatePostDto) {
    this.assertPostContent(dto.content, dto.mediaUrls);
    // Refused at the door rather than producing a post attached to nothing.
    await this.spaces.assertPostable(dto.spaceId);
    // Refuses remote images: see CommunityMediaService for why an arbitrary
    // URL in a post is a tracking pixel with extra steps.
    this.media.assertOwnMedia(dto.mediaUrls ?? []);

    let companyId: string | null = null;
    if (dto.asCompany) {
      companyId = (await this.companyVoiceFor(userId))?.id ?? null;
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

    const created = await this.prisma.post.create({
      data: {
        authorId: userId,
        companyId,
        spaceId: dto.spaceId,
        content: dto.content?.trim() || '',
        // A post carrying a poll is a poll, whatever the client said.
        postType: dto.poll ? 'POLL' : dto.postType || 'TEXT',
        mediaUrls: dto.mediaUrls ?? [],
        hashtags: mergedHashtags,
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
        content: true,
        mediaUrls: true,
        hashtags: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Post not found');
    }

    if (existing.authorId !== currentUser.id && currentUser.role !== 'ADMIN') {
      throw new ForbiddenException('You can only edit your own post');
    }

    const nextContent = dto.content !== undefined ? dto.content : existing.content;
    const nextMediaUrls = dto.mediaUrls !== undefined ? dto.mediaUrls : existing.mediaUrls;
    this.assertPostContent(nextContent, nextMediaUrls);

    const hashtags = this.normalizeHashtags(dto.hashtags ?? existing.hashtags);
    const contentHashtags = this.extractHashtags(nextContent);
    const mergedHashtags = Array.from(new Set([...hashtags, ...contentHashtags]));

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
        ...(dto.postType !== undefined ? { postType: dto.postType } : {}),
        ...(dto.mediaUrls !== undefined ? { mediaUrls: dto.mediaUrls } : {}),
        hashtags: mergedHashtags,
        isEdited: true,
      },
      include: this.buildPostInclude(),
    });

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
      select: { id: true, authorId: true },
    });

    if (!existing) {
      throw new NotFoundException('Post not found');
    }

    if (existing.authorId !== currentUser.id && currentUser.role !== 'ADMIN') {
      throw new ForbiddenException('You can only delete your own post');
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

    return { success: true, data: created, message: 'Post shared' };
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
      company: { select: { id: true, name: true } },
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
          createdAt: true,
          removedAt: true,
          authorId: true,
          author: {
            select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true, role: true, createdAt: true },
          },
          company: { select: { id: true, name: true } },
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

  private async addViewerFlags<T extends { id: string }>(
    posts: T[],
    currentUserId?: string,
  ): Promise<Array<T & { likedByMe: boolean; bookmarkedByMe: boolean }>> {
    if (!currentUserId || posts.length === 0) {
      return posts.map((post) => ({
        ...post,
        likedByMe: false,
        bookmarkedByMe: false,
      }));
    }

    const postIds = posts.map((post) => post.id);
    const [likes, bookmarks] = await Promise.all([
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
    ]);

    const likedPostIds = new Set(likes.map((item) => item.postId));
    const bookmarkedPostIds = new Set(bookmarks.map((item) => item.postId));

    return posts.map((post) => ({
      ...post,
      likedByMe: likedPostIds.has(post.id),
      bookmarkedByMe: bookmarkedPostIds.has(post.id),
    }));
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
