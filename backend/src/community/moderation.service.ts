import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReportStatus, SpaceMemberRole, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';
import { CommunityMediaService } from './media.service';

/** Why someone flagged something. A closed list keeps the queue sortable. */
export const REPORT_REASONS = [
  'harassment',
  'spam',
  'misinformation',
  'off_topic',
  'personal_information',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * Reporting and removal.
 *
 * A community where people name their employers needs this on the first day,
 * not once something goes wrong. Removal is soft throughout: a disputed
 * decision has to be reviewable, and a pattern of bad-faith reporting has to
 * be visible, and a hard delete destroys both.
 */
@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: CommunityMediaService,
  ) {}

  /* -------------------------------- reporting ------------------------------- */

  async reportPost(user: User, postId: string, reason: ReportReason, detail?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId === user.id) {
      throw new BadRequestException('You can delete your own post rather than reporting it.');
    }

    // Idempotent: raising the same concern twice is one concern.
    await this.prisma.postReport.upsert({
      where: { postId_reporterId: { postId, reporterId: user.id } },
      create: { postId, reporterId: user.id, reason, detail: detail?.trim() || null },
      update: { reason, detail: detail?.trim() || null },
    });
    return { reported: true };
  }

  async reportComment(user: User, commentId: string, reason: ReportReason, detail?: string) {
    const comment = await this.prisma.postComment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId === user.id) {
      throw new BadRequestException('You can delete your own comment rather than reporting it.');
    }

    await this.prisma.postReport.upsert({
      where: { commentId_reporterId: { commentId, reporterId: user.id } },
      create: { commentId, reporterId: user.id, reason, detail: detail?.trim() || null },
      update: { reason, detail: detail?.trim() || null },
    });
    return { reported: true };
  }

  /* ------------------------------- the queue -------------------------------- */

  /** Open reports, oldest first — the longest-waiting concern is the most urgent. */
  async listReports(user: User, status: ReportStatus = ReportStatus.OPEN) {
    await this.assertModerator(user);
    const reports = await this.prisma.postReport.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: {
        post: {
          select: { id: true, content: true, removedAt: true, authorId: true },
        },
        comment: {
          select: { id: true, content: true, removedAt: true, authorId: true, postId: true },
        },
      },
    });

    return reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      detail: r.detail,
      createdAt: r.createdAt,
      status: r.status,
      target: r.post
        ? { kind: 'post' as const, id: r.post.id, content: r.post.content, removed: !!r.post.removedAt }
        : r.comment
          ? {
              kind: 'comment' as const,
              id: r.comment.id,
              postId: r.comment.postId,
              content: r.comment.content,
              removed: !!r.comment.removedAt,
            }
          : null,
    }));
  }

  /* -------------------------------- decisions ------------------------------- */

  async removePost(user: User, postId: string, reason: string) {
    await this.assertModerator(user);
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, mediaUrls: true },
    });
    if (!post) throw new NotFoundException('Post not found');

    await this.prisma.$transaction([
      this.prisma.post.update({
        where: { id: postId },
        data: { removedAt: new Date(), removedById: user.id, removalReason: reason.trim() },
      }),
      // Every open report about it is answered by this one decision.
      this.prisma.postReport.updateMany({
        where: { postId, status: ReportStatus.OPEN },
        data: {
          status: ReportStatus.ACTIONED,
          reviewedById: user.id,
          reviewedAt: new Date(),
          resolution: reason.trim(),
        },
      }),
    ]);

    /**
     * The text is kept and the pictures are not.
     *
     * A public image URL survives the post vanishing from every feed, so with
     * an abusive picture continued hosting is itself the harm. What was
     * decided and why stays in the moderation record; the bytes do not.
     * Restoring brings the post back without them, which is stated below.
     */
    await this.media.deleteForUrls(post.mediaUrls);
    return { id: postId, removed: true, mediaDeleted: post.mediaUrls.length };
  }

  /**
   * Puts a post back.
   *
   * Its images do not come back — they were destroyed on removal. The URLs are
   * cleared rather than left pointing at nothing, so a restored post shows the
   * words that were written instead of a row of broken frames.
   */
  async restorePost(user: User, postId: string) {
    await this.assertModerator(user);
    await this.prisma.post.update({
      where: { id: postId },
      data: { removedAt: null, removedById: null, removalReason: null, mediaUrls: [] },
    });
    return { id: postId, removed: false };
  }

  async removeComment(user: User, commentId: string) {
    await this.assertModerator(user);
    await this.prisma.$transaction([
      this.prisma.postComment.update({
        where: { id: commentId },
        data: { removedAt: new Date(), removedById: user.id },
      }),
      this.prisma.postReport.updateMany({
        where: { commentId, status: ReportStatus.OPEN },
        data: { status: ReportStatus.ACTIONED, reviewedById: user.id, reviewedAt: new Date() },
      }),
    ]);
    return { id: commentId, removed: true };
  }

  /** Nothing wrong here. Recorded rather than silently closed. */
  async dismissReport(user: User, reportId: string, resolution?: string) {
    await this.assertModerator(user);
    await this.prisma.postReport.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.DISMISSED,
        reviewedById: user.id,
        reviewedAt: new Date(),
        resolution: resolution?.trim() || null,
      },
    });
    return { id: reportId, status: ReportStatus.DISMISSED };
  }

  /* --------------------------------- helpers -------------------------------- */

  /**
   * Platform admins, or anyone moderating a space.
   *
   * Space-scoped moderators are checked by role rather than by which space the
   * item is in: at this size there is one queue, and narrowing it per space
   * would leave reports on space-less posts unreachable by anyone.
   */
  private async assertModerator(user: User): Promise<void> {
    if (user.role === UserRole.ADMIN) return;
    const moderating = await this.prisma.spaceMember.findFirst({
      where: { userId: user.id, role: SpaceMemberRole.MODERATOR },
      select: { id: true },
    });
    if (!moderating) {
      throw new ForbiddenException('Only moderators can do that.');
    }
  }
}
