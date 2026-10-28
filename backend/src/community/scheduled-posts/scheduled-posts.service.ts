import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { Prisma, ScheduledPostStatus } from '@prisma/client';
import { ExclusiveCron } from '../../common/scheduling/exclusive-cron';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { personName } from '../../common/person-name';
import { CommunityMediaService } from '../media.service';
import { PostsService } from '../posts/posts.service';
import { CreatePostDto } from '../posts/dto/create-post.dto';
import { runsCompanyPage } from '../page-admins';
import { SchedulePostDto, UpdateScheduledPostDto } from './dto/scheduled-post.dto';

/** Soon enough to be worth scheduling rather than posting; far enough to be checkable. */
const MIN_LEAD_MS = 10 * 60_000;
/** LinkedIn's limit for pages, and about as far ahead as a plan holds. */
const MAX_LEAD_MS = 90 * 24 * 60 * 60_000;
/** A page's queue, not a content farm's. */
const MAX_QUEUED = 100;
/** Published per minute; anything over waits a minute, which a schedule allows. */
const BATCH = 20;
/** A run that took a post and never came back. */
const STALE_PUBLISHING_MS = 15 * 60_000;
const INTERRUPTED = 'Publishing was interrupted. Check the page for it before scheduling it again.';

/** What is kept for a scheduled post: the post as it will be created. */
type Payload = Omit<CreatePostDto, 'publishAt'>;

/**
 * Company posts written now and published at a set time.
 *
 * A scheduled post is not a post until its time comes: it lives in its own
 * table, so no feed, search, count or permalink can show something that has
 * not been published. When it is due, `publishDue` creates it with
 * `PostsService.create` — the same path as pressing Post, with every check
 * run again against how things stand then. Above all, whoever scheduled it
 * must still be an owner or admin of the company: someone who has left does
 * not keep speaking for it on a timer.
 *
 * Any of the page's owners and admins can see the queue, change a time or
 * the words, and cancel; the post still goes out under the name of whoever
 * wrote it.
 */
@Injectable()
export class ScheduledPostsService {
  private readonly logger = new Logger(ScheduledPostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly media: CommunityMediaService,
    private readonly notifications: NotificationsService,
  ) {}

  async schedule(userId: string, dto: SchedulePostDto) {
    const { publishAt, ...post } = dto;
    if (!post.asCompany) {
      throw new BadRequestException("Only posts in a company page's name can be scheduled.");
    }
    if (post.reference) {
      throw new BadRequestException('Announcements of listings go out when you post them, while the listing is open.');
    }
    const at = this.when(publishAt);
    const { companyId } = await this.posts.checkDraft(userId, post);
    if (!companyId) throw new ForbiddenException('Only an owner or admin of a company can post in its name.');

    const queued = await this.prisma.scheduledPost.count({
      where: { companyId, status: ScheduledPostStatus.SCHEDULED },
    });
    if (queued >= MAX_QUEUED) {
      throw new BadRequestException(`A page can have up to ${MAX_QUEUED} posts scheduled at once.`);
    }

    const created = await this.prisma.scheduledPost.create({
      data: {
        companyId,
        authorId: userId,
        publishAt: at,
        payload: { ...post, asCompany: true, companyId } as unknown as Prisma.InputJsonValue,
      },
      include: this.include(),
    });
    return this.shape(created);
  }

  /** The page's queue: what is coming, and what could not go out. Owners and admins only. */
  async listForCompany(userId: string, companyId: string) {
    await this.assertRunsPage(userId, companyId);
    const items = await this.prisma.scheduledPost.findMany({
      where: {
        companyId,
        status: { in: [ScheduledPostStatus.SCHEDULED, ScheduledPostStatus.PUBLISHING, ScheduledPostStatus.FAILED] },
      },
      orderBy: { publishAt: 'asc' },
      include: this.include(),
    });
    return items.map((item) => this.shape(item));
  }

  /**
   * A new time, new words, or both. A failed post can be given a new time,
   * which puts it back in the queue.
   */
  async update(userId: string, id: string, dto: UpdateScheduledPostDto) {
    const item = await this.owned(userId, id);
    if (item.status !== ScheduledPostStatus.SCHEDULED && item.status !== ScheduledPostStatus.FAILED) {
      throw new BadRequestException('It is being published and can no longer be changed.');
    }
    if (item.status === ScheduledPostStatus.FAILED && dto.publishAt === undefined) {
      throw new BadRequestException('Choose a new time to try it again.');
    }

    const payload = { ...(item.payload as unknown as Payload) };
    if (dto.content !== undefined) {
      payload.content = dto.content;
      // Checked as its writer, whose post it still is.
      await this.posts.checkDraft(item.authorId, payload);
    }

    const updated = await this.prisma.scheduledPost.update({
      where: { id },
      data: {
        payload: payload as unknown as Prisma.InputJsonValue,
        ...(dto.publishAt !== undefined
          ? { publishAt: this.when(dto.publishAt), status: ScheduledPostStatus.SCHEDULED, failureReason: null }
          : {}),
      },
      include: this.include(),
    });
    return this.shape(updated);
  }

  /** Taken out of the queue for good. Its pictures go with the hourly clean-up. */
  async cancel(userId: string, id: string) {
    const item = await this.owned(userId, id);
    if (item.status === ScheduledPostStatus.PUBLISHING || item.status === ScheduledPostStatus.PUBLISHED) {
      throw new BadRequestException('It has already gone out. Delete the post itself instead.');
    }
    await this.prisma.scheduledPost.delete({ where: { id } });
    return { id, canceled: true };
  }

  /**
   * Publishes what is due.
   *
   * Each post is taken before it is created, so a second run — another
   * server, or this one a minute later — cannot publish it twice. A run that
   * dies after taking a post leaves it "publishing"; after a while that is
   * reported as a failure rather than retried, because it may have gone out.
   */
  @ExclusiveCron(CronExpression.EVERY_MINUTE, { name: 'community-scheduled-posts' })
  async publishDue(now = new Date()): Promise<void> {
    try {
      await this.prisma.scheduledPost.updateMany({
        where: {
          status: ScheduledPostStatus.PUBLISHING,
          updatedAt: { lt: new Date(now.getTime() - STALE_PUBLISHING_MS) },
        },
        data: { status: ScheduledPostStatus.FAILED, failureReason: INTERRUPTED },
      });

      const due = await this.prisma.scheduledPost.findMany({
        where: { status: ScheduledPostStatus.SCHEDULED, publishAt: { lte: now } },
        orderBy: { publishAt: 'asc' },
        take: BATCH,
        select: { id: true, companyId: true, authorId: true, payload: true },
      });
      for (const item of due) await this.publishOne(item);
    } catch (err) {
      this.logger.error(`Publishing scheduled posts failed: ${(err as Error).message}`);
    }
  }

  private async publishOne(item: { id: string; companyId: string; authorId: string; payload: Prisma.JsonValue }) {
    const taken = await this.prisma.scheduledPost.updateMany({
      where: { id: item.id, status: ScheduledPostStatus.SCHEDULED },
      data: { status: ScheduledPostStatus.PUBLISHING },
    });
    if (taken.count === 0) return;

    try {
      const payload = item.payload as unknown as Payload;
      const result = await this.posts.create(item.authorId, { ...payload, asCompany: true, companyId: item.companyId });
      await this.prisma.scheduledPost.update({
        where: { id: item.id },
        data: { status: ScheduledPostStatus.PUBLISHED, postId: result.data.id, failureReason: null },
      });
    } catch (err) {
      // The server's own refusal is the useful reason ("Only a current
      // company owner or admin…"); anything else is ours, and said plainly.
      const reason = err instanceof HttpException ? err.message : 'Something went wrong while publishing it.';
      if (!(err instanceof HttpException)) this.logger.error(`Scheduled post ${item.id}: ${(err as Error).message}`);
      await this.prisma.scheduledPost.update({
        where: { id: item.id },
        data: { status: ScheduledPostStatus.FAILED, failureReason: reason },
      });
      await this.tellFailure(item, reason);
    }
  }

  /** Whoever scheduled it hears that it did not go out, and why. */
  private async tellFailure(item: { companyId: string; authorId: string }, reason: string) {
    const [company, page] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: item.companyId }, select: { name: true } }),
      this.prisma.employerProfile.findFirst({
        where: { companyId: item.companyId, visibility: { not: 'private' } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      }),
    ]);
    await this.notifications.create({
      userId: item.authorId,
      type: 'community',
      title: `A scheduled post for ${company?.name ?? 'your company'} wasn't published`,
      message: reason,
      link: page ? `/community/companies/${page.id}` : '/community',
    });
  }

  private when(publishAt: string, now = Date.now()): Date {
    const at = new Date(publishAt);
    if (Number.isNaN(at.getTime())) throw new BadRequestException('Choose a date and time.');
    if (at.getTime() < now + MIN_LEAD_MS) {
      throw new BadRequestException('Schedule it at least 10 minutes ahead, or post it now.');
    }
    if (at.getTime() > now + MAX_LEAD_MS) {
      throw new BadRequestException('Posts can be scheduled up to 90 days ahead.');
    }
    return at;
  }

  private async assertRunsPage(userId: string, companyId: string) {
    if (!(await runsCompanyPage(this.prisma, userId, companyId))) {
      throw new ForbiddenException("Only the page's owners and admins can see and change its scheduled posts.");
    }
  }

  /** A scheduled post on a page this person runs; one they cannot see is "not found". */
  private async owned(userId: string, id: string) {
    const item = await this.prisma.scheduledPost.findUnique({ where: { id } });
    if (!item || !(await runsCompanyPage(this.prisma, userId, item.companyId))) {
      throw new NotFoundException('Scheduled post not found');
    }
    return item;
  }

  private include() {
    return { author: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true } } } as const;
  }

  /** What the queue shows: when, who, and what will go out. */
  private shape(item: Prisma.ScheduledPostGetPayload<{ include: ReturnType<ScheduledPostsService['include']> }>) {
    const payload = item.payload as unknown as Payload;
    return {
      id: item.id,
      companyId: item.companyId,
      publishAt: item.publishAt,
      status: item.status,
      failureReason: item.failureReason,
      createdAt: item.createdAt,
      author: { id: item.author.id, name: personName(item.author, 'Someone'), avatarUrl: item.author.avatarUrl },
      content: payload.content ?? '',
      mediaUrls: payload.mediaUrls ?? [],
      document: payload.document
        ? { title: payload.document.title, pages: this.media.documentPagesFor(payload.document.url, item.authorId) }
        : null,
      poll: payload.poll ? { options: payload.poll.options } : null,
      spaceId: payload.spaceId ?? null,
      commentPolicy: payload.commentPolicy ?? 'ANYONE',
    };
  }
}
