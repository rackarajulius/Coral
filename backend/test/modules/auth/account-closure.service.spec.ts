import { BadGatewayException, ForbiddenException, Logger } from '@nestjs/common';
import { AccountClosureService } from '../../../src/auth/account-closure.service';
import { AuthService } from '../../../src/auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { StripeClient } from '../../../src/billing/stripe.client';
import { User } from '../../../src/common/types/user.types';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { StorageService } from '../../../src/storage/storage.service';
import { SupabaseService } from '../../../src/supabase/supabase.service';
import { CalendarService } from '../../../src/integrations/calendar.service';

describe('permanent job seeker account closure', () => {
  const user = { id: 'candidate', supabaseId: 'identity', role: 'JOB_SEEKER', status: 'ACTIVE' } as User;
  let retained: boolean;
  let committed: number;
  let failCommit: number;
  let service: AccountClosureService;
  let tx: Record<string, any>;
  let prisma: Record<string, any>;
  let supabase: Record<string, any>;
  let storage: Record<string, any>;
  let stripe: Record<string, any>;
  let calendar: Record<string, any>;

  beforeEach(() => {
    retained = true;
    committed = 0;
    failCommit = 0;
    tx = {};
    for (const model of ['interview', 'aiScreen', 'outreachMessage', 'shortlistItem', 'conversation',
      'interviewCoachReport', 'interviewCoachSession', 'googleCredential', 'microsoftCredential',
      'zoomCredential', 'postReport', 'reviewFlag', 'availabilitySlot', 'analyticsEvent', 'space',
      'candidateTag', 'scorecard', 'offer', 'emailTemplate', 'post', 'postComment']) {
      tx[model] = { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() };
    }
    tx.user = { deleteMany: jest.fn().mockImplementation(async () => {
      const count = retained ? 1 : 0;
      retained = false;
      return { count };
    }) };
    prisma = {
      user: { findUnique: jest.fn().mockImplementation(async () => retained ? user : null) },
      userSubscription: { findUnique: jest.fn().mockResolvedValue(null) },
      aiScreen: { findMany: jest.fn().mockResolvedValue([{ id: 'screen' }]) },
      conversation: { findMany: jest.fn().mockResolvedValue([{ id: 'thread' }]) },
      interview: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation(async (callback: (transaction: any) => Promise<unknown>) => {
        const before = retained;
        try {
          const result = await callback(tx);
          if (failCommit-- > 0) throw new Error('commit connection failed');
          committed++;
          return result;
        } catch (error) {
          retained = before;
          throw error;
        }
      }),
    };
    supabase = { assertAccountDeletionConfigured: jest.fn(), deleteAuthUser: jest.fn().mockResolvedValue(undefined) };
    storage = { deleteFilesUnder: jest.fn().mockResolvedValue(undefined) };
    stripe = { get: jest.fn(), post: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) };
    calendar = { deleteMeeting: jest.fn().mockResolvedValue(undefined) };
    service = new AccountClosureService(prisma as unknown as PrismaService, supabase as unknown as SupabaseService,
      storage as unknown as StorageService, stripe as unknown as StripeClient, calendar as unknown as CalendarService);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('requires explicit confirmation and a job seeker before any mutation', () => {
    expect(() => service.closeAccount(user, '')).toThrow('Confirm account closure');
    expect(() => service.closeAccount({ ...user, role: 'ADMIN' }, 'CLOSE')).toThrow(ForbiddenException);
    expect(supabase.assertAccountDeletionConfigured).not.toHaveBeenCalled();
  });

  it('refuses a changed or mismatched identity', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, supabaseId: 'another-identity' });
    await expect(service.closeAccount(user, 'CLOSE')).rejects.toThrow(ForbiddenException);
    expect(storage.deleteFilesUnder).not.toHaveBeenCalled();
    expect(supabase.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('deletes owned data, non-FK records, and scoped uploads once closure is committed', async () => {
    await service.closeAccount(user, 'CLOSE');
    expect(retained).toBe(false);
    expect(committed).toBe(1);
    expect(tx.user.deleteMany).toHaveBeenCalledWith({ where: { id: 'candidate', supabaseId: 'identity', role: 'JOB_SEEKER' } });
    for (const model of ['aiScreen', 'interview', 'outreachMessage', 'shortlistItem', 'conversation']) {
      expect(tx[model].deleteMany).toHaveBeenCalledWith({ where: { candidateId: 'candidate' } });
    }
    for (const model of ['interviewCoachSession', 'interviewCoachReport', 'googleCredential', 'microsoftCredential', 'zoomCredential']) {
      expect(tx[model].deleteMany).toHaveBeenCalledWith({ where: { userId: 'candidate' } });
    }
    expect(tx.reviewFlag.deleteMany).toHaveBeenCalledWith({ where: { reporterId: 'candidate' } });
    expect(storage.deleteFilesUnder).toHaveBeenCalledWith('resumes/candidate', 'resumes');
    expect(storage.deleteFilesUnder).toHaveBeenCalledWith('candidate', 'verification-documents');
    expect(storage.deleteFilesUnder).toHaveBeenCalledWith('avatars', 'profile-media', 'candidate-');
    expect(storage.deleteFilesUnder).toHaveBeenCalledWith('screens/screen', 'screen-videos');
    expect(storage.deleteFilesUnder).toHaveBeenCalledWith('messages/thread', 'message-attachments');
    expect(supabase.deleteAuthUser).toHaveBeenCalledWith('identity');
    expect(stripe.delete).not.toHaveBeenCalled();
    // Deleting a storage object cannot be undone, so it waits for the commit.
    expect(storage.deleteFilesUnder.mock.invocationCallOrder[0])
      .toBeGreaterThan(supabase.deleteAuthUser.mock.invocationCallOrder[0]);
  });

  it('closes the account and reports pending cleanup when uploads cannot be removed', async () => {
    storage.deleteFilesUnder.mockRejectedValue(new Error('private provider detail'));
    let error: BadGatewayException | undefined;
    try { await service.closeAccount(user, 'CLOSE'); } catch (caught) { error = caught as BadGatewayException; }
    // Closure already happened: claiming it failed would be false, and a retry
    // would only find a missing account.
    expect(retained).toBe(false);
    expect(committed).toBe(1);
    expect(supabase.deleteAuthUser).toHaveBeenCalledTimes(1);
    expect(error?.getResponse()).toEqual(expect.objectContaining({
      accountClosed: true, code: 'ACCOUNT_CLOSED_CLEANUP_PENDING',
    }));
    expect(JSON.stringify(error?.getResponse())).not.toContain('private provider detail');
  });

  it('rolls back database deletion when the authentication provider rejects closure', async () => {
    supabase.deleteAuthUser.mockRejectedValue(new BadGatewayException('Authentication provider unavailable'));
    await expect(service.closeAccount(user, 'CLOSE')).rejects.toThrow(BadGatewayException);
    expect(retained).toBe(true);
    expect(committed).toBe(0);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 30_000 });
    // The account still works, so its uploads have to still be there.
    expect(storage.deleteFilesUnder).not.toHaveBeenCalled();
  });

  it('refuses identity deletion if the user changed roles before database deletion', async () => {
    tx.user.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.closeAccount(user, 'CLOSE')).rejects.toThrow('Your account changed');
    expect(supabase.deleteAuthUser).not.toHaveBeenCalled();
    // This is the retryable one: the user is told to try again, so they must
    // still have a resume, identity documents and portfolio to try again with.
    expect(storage.deleteFilesUnder).not.toHaveBeenCalled();
  });

  it('finishes idempotent database cleanup if the provider succeeds but the first commit fails', async () => {
    failCommit = 1;
    await service.closeAccount(user, 'CLOSE');
    expect(retained).toBe(false);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(supabase.deleteAuthUser).toHaveBeenCalledTimes(1);
  });

  it('identifies partial closure when all database repair attempts fail', async () => {
    failCommit = 4;
    let error: BadGatewayException | undefined;
    try { await service.closeAccount(user, 'CLOSE'); } catch (caught) { error = caught as BadGatewayException; }
    expect(error?.getResponse()).toEqual(expect.objectContaining({
      accountClosed: true, code: 'ACCOUNT_CLOSED_CLEANUP_PENDING',
    }));
    expect(supabase.deleteAuthUser).toHaveBeenCalledTimes(1);
  });

  it('shares duplicate in-flight closure calls instead of mutating twice', async () => {
    await Promise.all([service.closeAccount(user, 'CLOSE'), service.closeAccount(user, 'CLOSE')]);
    expect(supabase.deleteAuthUser).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('cancels live subscriptions and expires only this job seeker pending checkout', async () => {
    prisma.userSubscription.findUnique.mockResolvedValue({ stripeCustomerId: 'cus_candidate', stripeSubscriptionId: 'sub_paid' });
    stripe.get.mockImplementation(async (path: string) => {
      if (path === '/subscriptions/sub_paid') return { id: 'sub_paid', status: 'active' };
      if (path.startsWith('/checkout/sessions?')) return { data: [
        { id: 'cs_own', status: 'open', metadata: { kind: 'jobseeker', userId: 'candidate' } },
        { id: 'cs_other', status: 'open', metadata: { kind: 'jobseeker', userId: 'another' } },
      ] };
      return { data: [{ id: 'sub_paid', status: 'active' }, { id: 'sub_old', status: 'canceled' }, { id: 'sub_trial', status: 'trialing' }] };
    });
    await service.closeAccount(user, 'CLOSE');
    expect(stripe.post).toHaveBeenCalledTimes(1);
    expect(stripe.post).toHaveBeenCalledWith('/checkout/sessions/cs_own/expire', {});
    expect(stripe.delete.mock.calls).toEqual([['/subscriptions/sub_paid'], ['/subscriptions/sub_trial']]);
    expect(stripe.delete.mock.invocationCallOrder[0]).toBeLessThan(supabase.deleteAuthUser.mock.invocationCallOrder[0]);
  });

  it('stops before deleting uploads or identity when subscription cancellation fails', async () => {
    prisma.userSubscription.findUnique.mockResolvedValue({ stripeSubscriptionId: 'sub_paid' });
    stripe.get.mockResolvedValue({ id: 'sub_paid', status: 'active' });
    stripe.delete.mockRejectedValue(new BadGatewayException('Billing provider unavailable'));
    await expect(service.closeAccount(user, 'CLOSE')).rejects.toThrow(BadGatewayException);
    expect(storage.deleteFilesUnder).not.toHaveBeenCalled();
    expect(supabase.deleteAuthUser).not.toHaveBeenCalled();
    expect(retained).toBe(true);
  });

  it('cancels external interview meetings through their original provider', async () => {
    prisma.interview.findMany.mockResolvedValue([{ employerId: 'employer', calendarEventId: 'event', calendarProvider: 'google', zoomMeetingId: 'zoom' }]);
    await service.closeAccount(user, 'CLOSE');
    expect(calendar.deleteMeeting).toHaveBeenCalledWith('employer', 'event', 'google', 'zoom');
    expect(calendar.deleteMeeting.mock.invocationCallOrder[0]).toBeGreaterThan(supabase.deleteAuthUser.mock.invocationCallOrder[0]);
  });

  it('leaves external meetings intact when closure itself is refused', async () => {
    prisma.interview.findMany.mockResolvedValue([{ employerId: 'employer', calendarEventId: 'event', calendarProvider: 'google', zoomMeetingId: null }]);
    tx.user.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.closeAccount(user, 'CLOSE')).rejects.toThrow('Your account changed');
    expect(calendar.deleteMeeting).not.toHaveBeenCalled();
  });

  it('still cancels meetings when only upload cleanup fails after closure', async () => {
    prisma.interview.findMany.mockResolvedValue([{ employerId: 'employer', calendarEventId: 'event', calendarProvider: 'google', zoomMeetingId: null }]);
    storage.deleteFilesUnder.mockRejectedValue(new Error('storage unavailable'));
    await expect(service.closeAccount(user, 'CLOSE')).rejects.toThrow(BadGatewayException);
    expect(calendar.deleteMeeting).toHaveBeenCalledWith('employer', 'event', 'google', null);
  });

  it('recounts surviving community posts after deleted likes, comments and reshares cascade', async () => {
    tx.post.findMany.mockResolvedValue([{ id: 'surviving-post' }]);
    tx.post.findUnique.mockResolvedValue({ _count: { likes: 2, comments: 3, bookmarks: 4, reshares: 5 } });
    await service.closeAccount(user, 'CLOSE');
    expect(tx.post.update).toHaveBeenCalledWith({ where: { id: 'surviving-post' }, data: {
      likesCount: 2, commentsCount: 3, bookmarksCount: 4, resharesCount: 5,
    } });
  });
});

describe('closed identities cannot be provisioned from cached Supabase data', () => {
  const identity = { id: 'identity', email: 'candidate@example.test' };
  it('requires a fresh accepted identity before linking or creating a missing account', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() } };
    const service = new AuthService(prisma as unknown as PrismaService, { get: jest.fn() } as unknown as ConfigService);
    const recheck = jest.fn().mockResolvedValue(false);
    await expect(service.findOrCreateUser(identity, recheck)).rejects.toThrow('This account is no longer available');
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    await expect(service.findOrCreateUser(identity)).rejects.toThrow('This account is no longer available');
  });

  it('still provisions a new signup after fresh verification succeeds', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'new-candidate' }) } };
    const service = new AuthService(prisma as unknown as PrismaService, { get: jest.fn() } as unknown as ConfigService);
    await expect(service.findOrCreateUser(identity, async () => true)).resolves.toEqual({ id: 'new-candidate' });
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ supabaseId: 'identity' }) }));
  });
});
