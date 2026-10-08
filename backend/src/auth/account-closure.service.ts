import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StripeClient } from '../billing/stripe.client';
import { User } from '../common/types/user.types';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarService } from '../integrations/calendar.service';
import {
  COMMUNITY_BUCKET,
  MESSAGE_ATTACHMENT_BUCKET,
  PROFILE_BUCKET,
  RESUME_BUCKET,
  SCREEN_VIDEO_BUCKET,
  StorageService,
  VERIFICATION_BUCKET,
} from '../storage/storage.service';
import { SupabaseService } from '../supabase/supabase.service';

type ProviderPage<T> = { data: T[]; has_more?: boolean };
type Subscription = { id: string; status: string };
type CheckoutSession = { id: string; status: string; metadata?: { kind?: string; userId?: string } };

/** Permanent self-service closure. IDs always come from the authenticated user. */
@Injectable()
export class AccountClosureService {
  private readonly logger = new Logger(AccountClosureService.name);
  private readonly closing = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly storage: StorageService,
    private readonly stripe: StripeClient,
    private readonly calendar: CalendarService,
  ) {}

  closeAccount(user: User, confirmation: string): Promise<void> {
    if (confirmation !== 'CLOSE') throw new BadRequestException('Confirm account closure before continuing.');
    if (user.role !== 'JOB_SEEKER') throw new ForbiddenException('Only job seekers can close an account here.');
    const pending = this.closing.get(user.id);
    if (pending) return pending;
    const operation = this.close(user).finally(() => this.closing.delete(user.id));
    this.closing.set(user.id, operation);
    return operation;
  }

  private async close(user: User): Promise<void> {
    this.supabase.assertAccountDeletionConfigured();
    const account = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!account) throw new NotFoundException('Account not found.');
    if (account.role !== 'JOB_SEEKER' || account.supabaseId !== user.supabaseId) {
      throw new ForbiddenException('You can only close your own job seeker account.');
    }

    // End recurring billing and pending subscription checkout before removing
    // the customer mapping. A webhook cannot restore a user after deletion.
    await this.stopBilling(user.id);
    const [screens, conversations, meetings] = await Promise.all([
      this.prisma.aiScreen.findMany({ where: { candidateId: user.id }, select: { id: true } }),
      this.prisma.conversation.findMany({ where: { candidateId: user.id }, select: { id: true } }),
      this.prisma.interview.findMany({
        where: { candidateId: user.id },
        select: { employerId: true, calendarEventId: true, calendarProvider: true, zoomMeetingId: true },
      }),
    ]);
    try {
      await this.storage.deleteFilesUnder(`resumes/${user.id}`, RESUME_BUCKET);
      await this.storage.deleteFilesUnder(user.id, VERIFICATION_BUCKET);
      await this.storage.deleteFilesUnder(`posts/${user.id}`, COMMUNITY_BUCKET);
      for (const folder of ['avatars', 'banners', 'intro-videos', 'portfolio']) {
        await this.storage.deleteFilesUnder(folder, PROFILE_BUCKET, `${user.id}-`);
      }
      for (const screen of screens) await this.storage.deleteFilesUnder(`screens/${screen.id}`, SCREEN_VIDEO_BUCKET);
      for (const conversation of conversations) {
        await this.storage.deleteFilesUnder(`messages/${conversation.id}`, MESSAGE_ATTACHMENT_BUCKET);
      }
    } catch {
      throw new BadGatewayException('Your uploaded files could not be removed. Please try closing your account again.');
    }

    let identityDeleted = false;
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.deleteDatabaseRecords(tx, user.id, user.supabaseId);
        // Last operation: a provider failure rolls back all database deletion.
        // Allow longer than the provider's 10s timeout, unlike Prisma's 5s default.
        await this.supabase.deleteAuthUser(user.supabaseId);
        identityDeleted = true;
      }, { timeout: 30_000 });
    } catch (error) {
      if (!identityDeleted) throw error;
      // The identity provider and database cannot share a transaction. If the
      // provider succeeded but the DB commit failed, finish the idempotent DB
      // cleanup immediately, rather than leaving an account nobody can enter.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.prisma.$transaction((tx) => this.deleteDatabaseRecords(tx, user.id, user.supabaseId, true), { timeout: 30_000 });
          await this.cancelMeetings(meetings);
          return;
        } catch { /* retry only the local cleanup; never resurrect the identity */ }
      }
      this.logger.error(`Account closure database cleanup requires retry for user ${user.id}`);
      throw new BadGatewayException({
        code: 'ACCOUNT_CLOSED_CLEANUP_PENDING',
        accountClosed: true,
        message: 'Your sign-in account is closed, but data cleanup could not finish. Please contact support.',
      });
    }
    await this.cancelMeetings(meetings);
  }

  private async cancelMeetings(meetings: Array<{
    employerId: string; calendarEventId: string | null; calendarProvider: string | null; zoomMeetingId: string | null;
  }>): Promise<void> {
    // Employer-owned events are changed only after closure is committed.
    // Existing integrations make cancellation best effort if disconnected.
    for (const meeting of meetings) {
      if (!meeting.calendarEventId && !meeting.zoomMeetingId) continue;
      try {
        await this.calendar.deleteMeeting(meeting.employerId, meeting.calendarEventId,
          meeting.calendarProvider, meeting.zoomMeetingId);
      } catch {
        this.logger.warn('An external interview meeting could not be removed after account closure');
      }
    }
  }

  private async stopBilling(userId: string): Promise<void> {
    const billing = await this.prisma.userSubscription.findUnique({ where: { userId } });
    if (!billing?.stripeCustomerId && !billing?.stripeSubscriptionId) return;
    const ids = new Set<string>();
    if (billing.stripeSubscriptionId) {
      const subscription = await this.stripe.get<Subscription>(`/subscriptions/${encodeURIComponent(billing.stripeSubscriptionId)}`);
      if (!['canceled', 'incomplete_expired'].includes(subscription.status)) ids.add(subscription.id);
    }
    if (billing.stripeCustomerId) {
      const customer = encodeURIComponent(billing.stripeCustomerId);
      let cursor: string | undefined;
      do {
        const page: ProviderPage<CheckoutSession> = await this.stripe.get(
          `/checkout/sessions?customer=${customer}&status=open&limit=100${cursor ? `&starting_after=${encodeURIComponent(cursor)}` : ''}`,
        );
        for (const session of page.data) {
          if (session.metadata?.kind === 'jobseeker' && session.metadata.userId === userId) {
            await this.stripe.post(`/checkout/sessions/${encodeURIComponent(session.id)}/expire`, {});
          }
        }
        cursor = page.has_more ? page.data[page.data.length - 1]?.id : undefined;
      } while (cursor);
      cursor = undefined;
      do {
        const page: ProviderPage<Subscription> = await this.stripe.get(
          `/subscriptions?customer=${customer}&status=all&limit=100${cursor ? `&starting_after=${encodeURIComponent(cursor)}` : ''}`,
        );
        for (const subscription of page.data) {
          if (!['canceled', 'incomplete_expired'].includes(subscription.status)) ids.add(subscription.id);
        }
        cursor = page.has_more ? page.data[page.data.length - 1]?.id : undefined;
      } while (cursor);
    }
    for (const id of ids) await this.stripe.delete(`/subscriptions/${encodeURIComponent(id)}`);
  }

  private async deleteDatabaseRecords(
    tx: Prisma.TransactionClient,
    userId: string,
    supabaseId: string,
    repair = false,
  ): Promise<void> {
    const affectedPosts = await tx.post.findMany({
      where: { authorId: { not: userId }, OR: [
        { likes: { some: { userId } } }, { bookmarks: { some: { userId } } },
        { comments: { some: { authorId: userId } } }, { reshares: { some: { authorId: userId } } },
      ] },
      select: { id: true },
    });
    // These older models hold plain IDs instead of User foreign keys. Their
    // candidate transcripts, notes and snapshots would survive a User cascade.
    const interviews = await tx.interview.findMany({ where: { candidateId: userId }, select: { id: true } });
    await tx.availabilitySlot.updateMany({
      where: { interviewId: { in: interviews.map((interview) => interview.id) } },
      data: { interviewId: null, status: 'open' },
    });
    await tx.interview.deleteMany({ where: { candidateId: userId } });
    await tx.aiScreen.deleteMany({ where: { candidateId: userId } });
    await tx.outreachMessage.deleteMany({ where: { candidateId: userId } });
    await tx.shortlistItem.deleteMany({ where: { candidateId: userId } });
    await tx.conversation.deleteMany({ where: { candidateId: userId } });
    await tx.interviewCoachReport.deleteMany({ where: { userId } });
    await tx.interviewCoachSession.deleteMany({ where: { userId } });
    await tx.googleCredential.deleteMany({ where: { userId } });
    await tx.microsoftCredential.deleteMany({ where: { userId } });
    await tx.zoomCredential.deleteMany({ where: { userId } });
    await tx.analyticsEvent.updateMany({ where: { viewerId: userId }, data: { viewerId: null } });
    await tx.postReport.deleteMany({ where: { reporterId: userId } });
    await tx.reviewFlag.deleteMany({ where: { reporterId: userId } });
    await tx.postReport.updateMany({ where: { reviewedById: userId }, data: { reviewedById: null } });
    await tx.space.updateMany({ where: { createdById: userId }, data: { createdById: null } });
    await tx.space.updateMany({
      where: { bannerUrl: { contains: `/storage/v1/object/public/${COMMUNITY_BUCKET}/posts/${userId}/` } },
      data: { bannerUrl: null },
    });
    await tx.post.updateMany({ where: { removedById: userId }, data: { removedById: null } });
    await tx.postComment.updateMany({ where: { removedById: userId }, data: { removedById: null } });
    await tx.candidateTag.updateMany({ where: { createdById: userId }, data: { createdById: null } });
    await tx.scorecard.updateMany({ where: { reviewerId: userId }, data: { reviewerId: null, reviewerName: 'Closed account' } });
    await tx.offer.updateMany({ where: { createdById: userId }, data: { createdById: null } });
    await tx.emailTemplate.updateMany({ where: { createdById: userId }, data: { createdById: null } });
    // deleteMany keeps the repair attempt idempotent. All declared User FKs
    // already cascade or set null, including profiles, applications and posts.
    const removed = await tx.user.deleteMany({ where: { id: userId, supabaseId, role: 'JOB_SEEKER' } });
    if (removed.count !== 1 && !repair) {
      throw new ForbiddenException('Your account changed during closure. Please try again.');
    }
    for (const post of affectedPosts) {
      const remaining = await tx.post.findUnique({
        where: { id: post.id }, select: { _count: { select: { likes: true, comments: true, bookmarks: true, reshares: true } } },
      });
      if (!remaining) continue;
      await tx.post.update({ where: { id: post.id }, data: {
        likesCount: remaining._count.likes, commentsCount: remaining._count.comments,
        bookmarksCount: remaining._count.bookmarks, resharesCount: remaining._count.reshares,
      } });
    }
  }
}
