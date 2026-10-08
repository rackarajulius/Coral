import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CommunityIdentityService } from '../identity.service';
import { User } from '../../common/types/user.types';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

/** First line or so of a comment, for a notification that has to fit one. */
function excerpt(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1).trimEnd() + String.fromCharCode(8230) : flat;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: CommunityIdentityService,
    private readonly notifications: NotificationsService,
  ) {}

  async listByPost(postId: string, query: ListCommentsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, removedAt: true },
    });

    if (!post || post.removedAt) {
      throw new NotFoundException('Post not found');
    }

    const [topLevelComments, total] = await Promise.all([
      this.prisma.postComment.findMany({
        where: {
          postId,
          parentId: null,
          removedAt: null,
        },
        include: { ...this.commentInclude(), _count: { select: { replies: true } } },
        orderBy: this.commentOrder(query.sort),
        skip,
        take: limit,
      }),
      this.prisma.postComment.count({
        where: {
          postId,
          parentId: null,
          removedAt: null,
        },
      }),
    ]);

    const topIds = topLevelComments.map((comment) => comment.id);
    const replies =
      topIds.length === 0
        ? []
        : await this.prisma.postComment.findMany({
            where: {
              parentId: { in: topIds },
              removedAt: null,
            },
            include: this.commentInclude(),
            orderBy: { createdAt: 'asc' },
          });

    const repliesByParent = new Map<string, typeof replies>();
    for (const reply of replies) {
      const bucket = repliesByParent.get(reply.parentId || '');
      if (bucket) {
        bucket.push(reply);
      } else {
        repliesByParent.set(reply.parentId || '', [reply]);
      }
    }

    const withReplies = topLevelComments.map((comment) => ({
      ...comment,
      replies: repliesByParent.get(comment.id) || [],
    }));

    // Resolved for both levels in one lookup — a reply from a verified
    // employer is exactly the case the badge exists for, so it cannot be
    // top-level only.
    const identities = await this.identity.resolve([
      ...withReplies.map((c) => c.authorId),
      ...replies.map((r) => r.authorId),
    ]);

    const data = withReplies.map((comment) => ({
      ...comment,
      authorIdentity: identities.get(comment.authorId)!,
      replies: comment.replies.map((reply) => ({
        ...reply,
        authorIdentity: identities.get(reply.authorId)!,
      })),
    }));

    return {
      data,
      postId,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async create(postId: string, userId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, removedAt: true },
    });

    if (!post || post.removedAt) {
      throw new NotFoundException('Post not found');
    }

    let parentAuthorId: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.postComment.findUnique({
        where: { id: dto.parentId },
        select: {
          id: true,
          postId: true,
          parentId: true,
          authorId: true,
          removedAt: true,
        },
      });

      if (!parent || parent.postId !== postId || parent.removedAt) {
        throw new BadRequestException('Invalid parent comment');
      }

      if (parent.parentId) {
        throw new BadRequestException('Replies can only target top-level comments');
      }

      parentAuthorId = parent.authorId;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Lock/update the live post first, matching hard post/comment deletion.
      // If moderation won the race after the read, create nothing and notify nobody.
      const active = await tx.post.updateMany({
        where: { id: postId, removedAt: null },
        data: { commentsCount: { increment: 1 } },
      });
      if (active.count !== 1) throw new NotFoundException('Post not found');

      if (dto.parentId) {
        // Recheck the reply target under a lock after any moderator commits.
        // A rejection rolls back the post counter increment above.
        const parents = await tx.$queryRaw<Array<{ authorId: string }>>`
          SELECT author_id AS "authorId" FROM post_comments
          WHERE id = ${dto.parentId} AND post_id = ${postId}
            AND parent_id IS NULL AND removed_at IS NULL
          FOR UPDATE
        `;
        if (parents.length !== 1) throw new BadRequestException('Invalid parent comment');
        parentAuthorId = parents[0].authorId;
      }

      const created = await tx.postComment.create({
        data: {
          postId,
          authorId: userId,
          parentId: dto.parentId,
          content: dto.content.trim(),
        },
        include: this.commentInclude(),
      });

      return {
        success: true,
        data: created,
        message: 'Comment created successfully',
      };
    });

    // Outside the transaction: a notification that fails must not lose the
    // comment, and nothing should be announced that was not committed.
    void this.announce({
      postId,
      postAuthorId: post.authorId,
      parentAuthorId,
      commenterId: userId,
      comment: dto.content.trim(),
    });

    return result;
  }

  /**
   * Tells the people a new comment concerns.
   *
   * Two rules decide who hears about it:
   *
   * - **Never yourself.** Commenting on your own post, or replying to your own
   *   comment, notifies nobody.
   * - **Never twice.** Someone who is both the post's author and the person
   *   being replied to gets the reply notification only, because that is the
   *   more specific of the two.
   *
   * Likes are deliberately absent. A notification per like is noise the moment
   * anything is popular, and noise is what makes people turn the bell off —
   * after which the notifications that matter go unseen too.
   */
  private async announce(input: {
    postId: string;
    postAuthorId: string;
    parentAuthorId: string | null;
    commenterId: string;
    comment: string;
  }) {
    const actor = await this.prisma.user.findUnique({
      where: { id: input.commenterId },
      select: { displayName: true, firstName: true, lastName: true },
    });
    const who =
      actor?.displayName?.trim() ||
      [actor?.firstName, actor?.lastName].filter(Boolean).join(' ').trim() ||
      'Someone';

    const link = `/community/posts/${input.postId}`;
    const told = new Set<string>([input.commenterId]);

    if (input.parentAuthorId && !told.has(input.parentAuthorId)) {
      told.add(input.parentAuthorId);
      await this.notifications.create({
        userId: input.parentAuthorId,
        type: 'community',
        title: `${who} replied to your comment`,
        message: excerpt(input.comment),
        link,
      });
    }

    if (!told.has(input.postAuthorId)) {
      told.add(input.postAuthorId);
      await this.notifications.create({
        userId: input.postAuthorId,
        type: 'community',
        title: `${who} commented on your post`,
        // The comment, not the post: the reader already knows what they wrote.
        message: excerpt(input.comment),
        link,
      });
    }
  }

  async update(postId: string, commentId: string, currentUser: User, dto: UpdateCommentDto) {
    const existing = await this.prisma.postComment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        postId: true,
        authorId: true,
      },
    });

    if (!existing || existing.postId !== postId) {
      throw new NotFoundException('Comment not found');
    }

    if (existing.authorId !== currentUser.id && currentUser.role !== 'ADMIN') {
      throw new ForbiddenException('You can only edit your own comment');
    }

    const updated = await this.prisma.postComment.update({
      where: { id: commentId },
      data: {
        content: dto.content.trim(),
        isEdited: true,
      },
      include: this.commentInclude(),
    });

    return {
      success: true,
      data: updated,
      message: 'Comment updated successfully',
    };
  }

  async delete(postId: string, commentId: string, currentUser: User) {
    const existing = await this.prisma.postComment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        postId: true,
        authorId: true,
        parentId: true,
      },
    });

    if (!existing || existing.postId !== postId) {
      throw new NotFoundException('Comment not found');
    }

    if (existing.authorId !== currentUser.id && currentUser.role !== 'ADMIN') {
      throw new ForbiddenException('You can only delete your own comment');
    }

    return this.prisma.$transaction(async (tx) => {
      // Use the same post -> comment lock order as creation and post cascades.
      const posts = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM posts WHERE id = ${postId} FOR UPDATE
      `;
      if (posts.length !== 1) throw new NotFoundException('Post not found');
      let removed = 1;

      if (!existing.parentId) {
        removed += await tx.postComment.count({
          where: {
            parentId: existing.id,
          },
        });

        await tx.postComment.deleteMany({
          where: {
            parentId: existing.id,
          },
        });
      }

      await tx.postComment.delete({
        where: { id: existing.id },
      });

      await tx.post.update({
        where: { id: postId },
        data: {
          commentsCount: {
            decrement: removed,
          },
        },
      });

      return {
        success: true,
        message: 'Comment deleted successfully',
      };
    });
  }

  /** Ordering for the top-level list. Replies always read oldest-first. */
  private commentOrder(sort?: string) {
    if (sort === 'oldest') return { createdAt: 'asc' as const };
    if (sort === 'replies') {
      return [
        { replies: { _count: 'desc' as const } },
        { createdAt: 'desc' as const },
      ];
    }
    return { createdAt: 'desc' as const };
  }

  private commentInclude() {
    return {
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
    };
  }
}
