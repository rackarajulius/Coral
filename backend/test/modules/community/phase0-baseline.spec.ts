import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CompanyMemberStatus, CompanyRole, ReportStatus, SpaceMemberRole, TideMode, TideRsvp, UserRole } from '@prisma/client';
import { PostsService } from '../../../src/community/posts/posts.service';
import { SpacesService } from '../../../src/community/spaces/spaces.service';
import { ModerationService } from '../../../src/community/moderation.service';
import { TidesService } from '../../../src/community/tides/tides.service';
import { User } from '../../../src/common/types/user.types';

// Narrow collaborators keep these service-boundary tests independent of a database,
// authentication provider, storage, and streaming service. They are not HTTP/e2e tests.
function collaborator<T>(value: unknown): T {
  return value as T;
}

const NOW = new Date('2026-10-07T09:00:00.000Z');
const MINUTE = 60_000;
const PRIVATE_JOIN_URL = 'https://meet.example.test/private-tide';
const member = (id: string, role: UserRole = UserRole.JOB_SEEKER) => ({ id, role } as User);
const company = (role: CompanyRole, companyId = 'company-a') => ({
  role, companyId, companyName: 'Company A', memberUserIds: ['host', 'teammate'],
});

function tide(offsetMinutes = 30) {
  return {
    id: 'tide-a', title: 'Meet the team', description: null,
    hostId: 'host', companyId: 'company-a', mode: TideMode.ONLINE,
    startsAt: new Date(NOW.getTime() + offsetMinutes * MINUTE),
    endsAt: new Date(NOW.getTime() + (offsetMinutes + 60) * MINUTE),
    timezone: 'Africa/Kampala', joinUrl: PRIVATE_JOIN_URL,
    location: null, capacity: 2, canceledAt: null as Date | null,
    cancelReason: null, updatedAt: NOW,
  };
}

function tideHarness(event = tide()) {
  const prisma = {
    tide: {
      findUnique: jest.fn().mockResolvedValue(event),
      findMany: jest.fn().mockResolvedValue([event]),
      count: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockResolvedValue(event),
      create: jest.fn().mockResolvedValue(event),
    },
    tideAttendee: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      upsert: jest.fn().mockResolvedValue({ status: TideRsvp.GOING }),
    },
    companyMember: {
      findUnique: jest.fn().mockImplementation(async ({ where }) =>
        where.companyId_userId.userId === 'host'
          ? { role: CompanyRole.OWNER, status: CompanyMemberStatus.ACTIVE }
          : null),
    },
    post: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  // The callback uses the same mocks as the outside client; this checks service
  // decisions, but cannot model transaction isolation or competing reservations.
  prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) => callback(prisma));
  const context = { forUser: jest.fn().mockResolvedValue(null) };
  const notifications = { create: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue('https://coral.example.test') };
  const service = new TidesService(
    collaborator(prisma), collaborator(context), collaborator(notifications), collaborator(config),
  );
  return { service, prisma, context, event };
}

describe('Phase 0 community baseline: company voice and author authority', () => {
  function postsHarness() {
    const prisma = {
      post: {
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'post-a', ...data })),
        findUnique: jest.fn().mockResolvedValue({
          id: 'post-a', authorId: 'author', content: 'Original', mediaUrls: [], hashtags: [],
        }),
        update: jest.fn(), delete: jest.fn(),
      },
      postLike: { findMany: jest.fn().mockResolvedValue([]) },
      postBookmark: { findMany: jest.fn().mockResolvedValue([]) },
      companyMember: { findMany: jest.fn().mockResolvedValue([{ companyId: 'company-a' }]) },
    };
    const spaces = { assertPostable: jest.fn().mockResolvedValue(undefined), joinOnPost: jest.fn().mockResolvedValue(undefined) };
    const context = { forUser: jest.fn().mockResolvedValue(null) };
    const service = new PostsService(
      collaborator(prisma), collaborator(spaces), collaborator({ resolve: jest.fn().mockResolvedValue(new Map()) }),
      collaborator({ assertOwnMedia: jest.fn() }), collaborator({}),
      collaborator({ firstUrl: jest.fn().mockReturnValue(null) }),
      collaborator(context), collaborator({}),
    );
    return { service, prisma, spaces, context };
  }

  it.each([CompanyRole.OWNER, CompanyRole.ADMIN])('derives company identity for an active %s', async (role) => {
    const { service, context, prisma } = postsHarness();
    context.forUser.mockResolvedValue(company(role));
    const result = await service.create('author', {
      spaceId: 'space-a', content: 'Hiring now', asCompany: true,
    });
    expect(result.data).toMatchObject({ authorId: 'author', companyId: 'company-a' });
    expect(prisma.post.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ companyId: 'company-a' }),
    }));
  });

  it.each([
    CompanyRole.RECRUITER, CompanyRole.HIRING_MANAGER, CompanyRole.INTERVIEWER, CompanyRole.VIEWER,
  ])('refuses publishing in the company name for %s', async (role) => {
    const { service, context, prisma } = postsHarness();
    context.forUser.mockResolvedValue(company(role));
    await expect(service.create('author', {
      spaceId: 'space-a', content: 'Hiring now', asCompany: true,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('does not silently publish personally when company authority is absent', async () => {
    const { service, prisma } = postsHarness();
    await expect(service.create('author', {
      spaceId: 'space-a', content: 'Hiring now', asCompany: true,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('refuses edits and deletion by another ordinary member', async () => {
    const { service, prisma } = postsHarness();
    await expect(service.update('post-a', member('other'), { content: 'Replaced' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.delete('post-a', member('other'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.post.update).not.toHaveBeenCalled();
    expect(prisma.post.delete).not.toHaveBeenCalled();
  });
});

describe('Phase 0 community baseline: Space authority and retirement', () => {
  function spacesHarness() {
    const prisma = {
      spaceMember: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      space: {
        findUnique: jest.fn().mockResolvedValue({ id: 'space-a', archivedAt: NOW }),
        update: jest.fn().mockResolvedValue({ id: 'space-a', bannerUrl: null }),
      },
    };
    const service = new SpacesService(collaborator(prisma), collaborator({ assertOwnMedia: jest.fn() }));
    return { service, prisma };
  }

  it('prevents joining or publishing into an archived Space', async () => {
    const { service, prisma } = spacesHarness();
    await expect(service.join(member('user-a'), 'space-a')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.assertPostable('space-a')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.spaceMember.upsert).not.toHaveBeenCalled();
  });

  it('requires a moderator membership in the specific Space before changing its banner', async () => {
    const { service, prisma } = spacesHarness();
    await expect(service.setBanner(member('moderator-elsewhere'), 'space-a', null))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.space.update).not.toHaveBeenCalled();

    prisma.spaceMember.findUnique.mockResolvedValue({ role: SpaceMemberRole.MODERATOR });
    await expect(service.setBanner(member('moderator-here'), 'space-a', null))
      .resolves.toEqual({ id: 'space-a', bannerUrl: null });
    expect(prisma.spaceMember.findUnique).toHaveBeenLastCalledWith({
      where: { spaceId_userId: { spaceId: 'space-a', userId: 'moderator-here' } },
      select: { role: true },
    });
  });
});

describe('Phase 0 Tides baseline: meeting-link privacy', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(NOW); });
  afterEach(() => jest.useRealTimers());

  it.each([
    { label: 'anonymous viewer within the window', viewerId: undefined, status: null, minutes: 30, canceled: false, expected: null },
    { label: 'signed-in non-attendee', viewerId: 'viewer', status: null, minutes: 30, canceled: false, expected: null },
    { label: 'INTERESTED attendee', viewerId: 'viewer', status: TideRsvp.INTERESTED, minutes: 30, canceled: false, expected: null },
    { label: 'GOING attendee before the window', viewerId: 'viewer', status: TideRsvp.GOING, minutes: 61, canceled: false, expected: null },
    { label: 'GOING attendee at the opening boundary', viewerId: 'viewer', status: TideRsvp.GOING, minutes: 60, canceled: false, expected: PRIVATE_JOIN_URL },
    { label: 'GOING attendee of a cancelled Tide', viewerId: 'viewer', status: TideRsvp.GOING, minutes: 30, canceled: true, expected: null },
  ])('returns the correct join access for $label in detail and listing', async ({ viewerId, status, minutes, canceled, expected }) => {
    const event = tide(minutes);
    event.canceledAt = canceled ? NOW : null;
    const { service, prisma } = tideHarness(event);
    prisma.tideAttendee.findMany.mockResolvedValue(status ? [{ tideId: event.id, status }] : []);

    expect((await service.getById(event.id, viewerId)).joinUrl).toBe(expected);
    const listing = await service.list({ viewerId });
    expect(listing.data[0].joinUrl).toBe(expected);
  });

  it('puts only the Tide page in the public calendar download', async () => {
    const { service, event } = tideHarness();
    const calendar = await service.ics(event.id);
    expect(calendar.content).toContain('https://coral.example.test/community/tides/tide-a');
    expect(calendar.content).not.toContain(PRIVATE_JOIN_URL);
  });
});

describe('Phase 0 Tides baseline: owner and company authority', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(NOW); });
  afterEach(() => jest.useRealTimers());

  it('lets the original host edit a personal Tide without requiring a company role', async () => {
    const { service, event, context, prisma } = tideHarness();
    const personalEvent = { ...event, companyId: null };
    prisma.tide.findUnique.mockResolvedValue(personalEvent);
    await expect(service.update(event.id, 'host', { title: 'Updated' })).resolves.toBeDefined();
    expect(context.forUser).not.toHaveBeenCalled();
    expect(prisma.companyMember.findUnique).not.toHaveBeenCalled();
  });

  it.each([CompanyRole.OWNER, CompanyRole.ADMIN])('lets a same-company %s edit a company Tide', async (role) => {
    const { service, event, prisma } = tideHarness();
    prisma.companyMember.findUnique.mockResolvedValue({ role, status: CompanyMemberStatus.ACTIVE });
    await expect(service.update(event.id, 'teammate', { title: 'Updated' })).resolves.toBeDefined();
  });

  it.each([
    { label: 'recruiter in the company', context: company(CompanyRole.RECRUITER) },
    { label: 'owner of another company', context: company(CompanyRole.OWNER, 'company-b') },
    { label: 'person without company membership', context: null },
  ])('refuses edit and cancellation by a $label', async ({ context: callerContext }) => {
    const { service, event, context, prisma } = tideHarness();
    context.forUser.mockResolvedValue(callerContext);
    await expect(service.update(event.id, 'other', { title: 'Updated' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.cancel(event.id, 'other', {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.tide.update).not.toHaveBeenCalled();
  });

  it('refuses to create a company Tide for a recruiter', async () => {
    const { service, context, prisma } = tideHarness();
    context.forUser.mockResolvedValue(company(CompanyRole.RECRUITER));
    await expect(service.create('recruiter', {
      title: 'Meet the team', startsAt: tide().startsAt.toISOString(),
      timezone: 'Africa/Kampala', mode: TideMode.ONLINE, asCompany: true,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.tide.create).not.toHaveBeenCalled();
  });
});

describe('Phase 0 Tides baseline: RSVP capacity and lifecycle', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(NOW); });
  afterEach(() => jest.useRealTimers());

  it('refuses a new GOING reservation when capacity is already full', async () => {
    const { service, prisma } = tideHarness();
    prisma.tideAttendee.count.mockResolvedValue(2);
    await expect(service.rsvp('tide-a', 'viewer', { status: TideRsvp.GOING }))
      .rejects.toThrow('That tide is full.');
    expect(prisma.tideAttendee.upsert).not.toHaveBeenCalled();
  });

  it('allows an existing GOING attendee to repeat their RSVP at full capacity', async () => {
    const { service, prisma } = tideHarness();
    prisma.tideAttendee.findUnique.mockResolvedValue({ id: 'reservation', status: TideRsvp.GOING });
    prisma.tideAttendee.count.mockResolvedValue(2);
    await expect(service.rsvp('tide-a', 'viewer', { status: TideRsvp.GOING })).resolves.toBeDefined();
    expect(prisma.tideAttendee.upsert).toHaveBeenCalledTimes(1);
  });

  it('allows INTERESTED without consuming a GOING place when capacity is full', async () => {
    const { service, prisma } = tideHarness();
    prisma.tideAttendee.count.mockResolvedValue(2);
    await expect(service.rsvp('tide-a', 'viewer', { status: TideRsvp.INTERESTED })).resolves.toBeDefined();
    expect(prisma.tideAttendee.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: TideRsvp.INTERESTED }),
    }));
  });

  it('prevents shrinking capacity below existing GOING attendees', async () => {
    const { service, prisma } = tideHarness();
    prisma.tideAttendee.count.mockResolvedValue(2);
    await expect(service.update('tide-a', 'host', { capacity: 1 }))
      .rejects.toThrow('Capacity cannot be set below that.');
    expect(prisma.tide.update).not.toHaveBeenCalled();
  });

  it.each([TideRsvp.GOING, TideRsvp.INTERESTED])('refuses a late %s RSVP after the Tide starts', async (status) => {
    const { service, prisma } = tideHarness(tide(-1));
    await expect(service.rsvp('tide-a', 'viewer', { status })).rejects.toThrow('already started');
    expect(prisma.tideAttendee.upsert).not.toHaveBeenCalled();
  });

  it('refuses RSVP and edits after cancellation, and keeps repeated cancellation idempotent', async () => {
    const event = tide();
    event.canceledAt = NOW;
    const { service, prisma } = tideHarness(event);
    await expect(service.rsvp('tide-a', 'viewer', { status: TideRsvp.GOING })).rejects.toThrow('cancelled');
    await expect(service.update('tide-a', 'host', { title: 'Updated' })).rejects.toThrow('cancelled');
    await expect(service.cancel('tide-a', 'host', {})).resolves.toEqual(event);
    expect(prisma.tideAttendee.upsert).not.toHaveBeenCalled();
    expect(prisma.tide.update).not.toHaveBeenCalled();
  });
});

describe('Community moderation: current scoped authority', () => {
  function moderationHarness() {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: UserRole.JOB_SEEKER, status: 'ACTIVE' }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(),
      postReport: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn(), findUnique: jest.fn().mockResolvedValue({ postId: 'post-a' }) },
    };
    prisma.$transaction.mockImplementation((work) => work(prisma));
    const service = new ModerationService(collaborator(prisma), collaborator({}));
    return { service, prisma };
  }

  it('denies the reports queue and dismissal to an ordinary member', async () => {
    const { service, prisma } = moderationHarness();
    await expect(service.listReports(member('ordinary'))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.dismissReport(member('ordinary'), 'report-a')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.postReport.findMany).not.toHaveBeenCalled();
    expect(prisma.postReport.update).not.toHaveBeenCalled();
  });

  it('allows platform administrators to access the queue', async () => {
    const { service, prisma } = moderationHarness();
    prisma.user.findUnique.mockResolvedValue({ role: UserRole.ADMIN, status: 'ACTIVE' });
    await expect(service.listReports(member('admin', UserRole.ADMIN))).resolves.toEqual([]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('limits both post and comment reports to currently moderated Spaces', async () => {
    const { service, prisma } = moderationHarness();
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ space_id: 'space-a' }]);
    await service.listReports(member('space-a-moderator'));
    expect(prisma.postReport.findMany.mock.calls[0][0].where).toEqual({ status: ReportStatus.OPEN,
      OR: [{ post: { spaceId: { in: ['space-a'] } } }, { comment: { post: { spaceId: { in: ['space-a'] } } } }],
    });
  });

  it('does not trust a stale administrator role on the supplied user', async () => {
    const { service, prisma } = moderationHarness();
    await expect(service.listReports(member('demoted', UserRole.ADMIN))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.postReport.findMany).not.toHaveBeenCalled();
  });
});
