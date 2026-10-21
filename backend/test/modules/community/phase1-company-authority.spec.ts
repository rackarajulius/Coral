import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompanyMemberStatus, CompanyRole, TideMode, UserRole } from '@prisma/client';
import { PostsService } from '../../../src/community/posts/posts.service';
import { TidesService } from '../../../src/community/tides/tides.service';
import { User } from '../../../src/common/types/user.types';

function collaborator<T>(value: unknown): T { return value as T; }
const user = (id: string, role: UserRole = UserRole.JOB_SEEKER) => ({ id, role } as User);
const activeSeat = (role: CompanyRole = CompanyRole.OWNER) => ({ role, status: CompanyMemberStatus.ACTIVE });
const NOW = new Date('2026-10-07T09:00:00Z');
const companyPost = () => ({
  id: 'post-a', authorId: 'original-author', companyId: 'company-a',
  content: 'Company news', mediaUrls: [], hashtags: [], removedAt: null,
});
const companyTide = () => ({
  id: 'tide-a', hostId: 'original-host', companyId: 'company-a',
  title: 'Company event', description: null, mode: TideMode.ONLINE,
  startsAt: new Date('2026-10-08T09:00:00Z'), endsAt: new Date('2026-10-08T10:00:00Z'),
  timezone: 'America/Toronto', capacity: null, canceledAt: null as Date | null,
  cancelReason: null as string | null,
});

function postsHarness() {
  const post = companyPost();
  const prisma = {
    post: {
      findUnique: jest.fn().mockResolvedValue(post),
      findMany: jest.fn().mockResolvedValue([post]),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'new-post', ...data })),
      update: jest.fn().mockImplementation(async ({ data }) => ({ ...post, ...data })),
      delete: jest.fn().mockResolvedValue(post),
    },
    companyMember: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    postLike: { findMany: jest.fn().mockResolvedValue([]) },
    postBookmark: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((work: (tx: typeof prisma) => unknown) => work(prisma));
  // Even an old context that still claims authority cannot replace the live seat.
  const context = { forUser: jest.fn().mockResolvedValue({ companyId: 'company-a', role: CompanyRole.OWNER }) };
  const service = new PostsService(
    collaborator(prisma), collaborator({ assertPostable: jest.fn(), joinOnPost: jest.fn() }), collaborator({ resolve: jest.fn().mockResolvedValue(new Map()) }),
    collaborator({ assertOwnMedia: jest.fn() }), collaborator({}), collaborator({ firstUrl: jest.fn().mockReturnValue(null) }),
    collaborator(context), collaborator({}),
  );
  return { service, prisma, post, context };
}

function tidesHarness() {
  const tide = companyTide();
  const prisma = {
    tide: {
      findUnique: jest.fn().mockResolvedValue(tide),
      update: jest.fn().mockImplementation(async ({ data }) => ({ ...tide, ...data })),
    },
    companyMember: { findUnique: jest.fn().mockResolvedValue(null) },
    tideAttendee: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
  };
  const context = { forUser: jest.fn().mockResolvedValue({ companyId: 'company-a', role: CompanyRole.OWNER }) };
  const service = new TidesService(
    collaborator(prisma), collaborator(context), collaborator({ create: jest.fn() }), collaborator({}),
  );
  return { service, prisma, tide, context };
}

const deniedSeats = [
  { label: 'removed owner', seat: { role: CompanyRole.OWNER, status: CompanyMemberStatus.REMOVED } },
  { label: 'suspended admin', seat: { role: CompanyRole.ADMIN, status: CompanyMemberStatus.SUSPENDED } },
  { label: 'pending owner', seat: { role: CompanyRole.OWNER, status: CompanyMemberStatus.PENDING } },
  { label: 'active recruiter', seat: activeSeat(CompanyRole.RECRUITER) },
  { label: 'active hiring manager', seat: activeSeat(CompanyRole.HIRING_MANAGER) },
  { label: 'active interviewer', seat: activeSeat(CompanyRole.INTERVIEWER) },
  { label: 'active viewer', seat: activeSeat(CompanyRole.VIEWER) },
  { label: 'absent membership', seat: null },
];

describe('Phase 1 company posts: current seat authority', () => {
  it.each([CompanyRole.OWNER, CompanyRole.ADMIN])('lets a current %s maintain a former colleague\'s company post', async (role) => {
    const { service, prisma, context } = postsHarness();
    prisma.companyMember.findUnique.mockResolvedValue(activeSeat(role));
    prisma.companyMember.findMany.mockResolvedValue([{ companyId: 'company-a' }]);
    const editor = user('current-teammate', UserRole.EMPLOYER);

    const updated = await service.update('post-a', editor, { content: 'Updated company news' });
    expect(updated.data).toMatchObject({ authorId: 'original-author', companyId: 'company-a', content: 'Updated company news', canEdit: true });
    expect((await service.getById('post-a', editor)).canEdit).toBe(true);
    await expect(service.delete('post-a', editor)).resolves.toMatchObject({ success: true });
    expect(prisma.companyMember.findUnique).toHaveBeenCalledWith({
      where: { companyId_userId: { companyId: 'company-a', userId: editor.id } },
      select: { role: true, status: true },
    });
    expect(context.forUser).not.toHaveBeenCalled();
  });

  it.each(deniedSeats)('refuses the original author when their seat is $label', async ({ seat }) => {
    const { service, prisma } = postsHarness();
    prisma.companyMember.findUnique.mockResolvedValue(seat);
    const author = user('original-author');
    await expect(service.update('post-a', author, { content: 'Unauthorized' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.delete('post-a', author)).rejects.toBeInstanceOf(ForbiddenException);
    expect((await service.getById('post-a', author)).canEdit).toBe(false);
    expect(prisma.post.update).not.toHaveBeenCalled();
    expect(prisma.post.delete).not.toHaveBeenCalled();
  });

  it('refuses an owner of a different company, even with a current company context', async () => {
    const { service, prisma, context } = postsHarness();
    context.forUser.mockResolvedValue({ companyId: 'company-b', role: CompanyRole.OWNER });
    prisma.companyMember.findUnique.mockImplementation(async ({ where }) =>
      where.companyId_userId.companyId === 'company-b' ? activeSeat() : null);
    await expect(service.update('post-a', user('company-b-owner'), { content: 'Changed' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.post.update).not.toHaveBeenCalled();
  });

  it('does not give platform ADMIN a company-edit bypass', async () => {
    const { service, prisma } = postsHarness();
    const admin = user('platform-admin', UserRole.ADMIN);
    await expect(service.update('post-a', admin, { content: 'Changed' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.delete('post-a', admin)).rejects.toBeInstanceOf(ForbiddenException);
    expect((await service.getById('post-a', admin)).canEdit).toBe(false);
    expect(prisma.post.update).not.toHaveBeenCalled();
  });

  it('checks the seat again on the next action after membership revocation', async () => {
    const { service, prisma } = postsHarness();
    prisma.companyMember.findUnique.mockResolvedValueOnce(activeSeat())
      .mockResolvedValue({ role: CompanyRole.OWNER, status: CompanyMemberStatus.REMOVED });
    const author = user('original-author');
    await service.update('post-a', author, { content: 'Allowed while active' });
    await expect(service.delete('post-a', author)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.companyMember.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.post.delete).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'author', viewer: user('original-author') },
    { label: 'platform admin', viewer: user('platform-admin', UserRole.ADMIN) },
  ])('preserves $label authority over a personal post', async ({ viewer }) => {
    const { service, prisma, post } = postsHarness();
    prisma.post.findUnique.mockResolvedValue({ ...post, companyId: null });
    await expect(service.update(post.id, viewer, { content: 'Personal update' })).resolves.toBeDefined();
    await expect(service.delete(post.id, viewer)).resolves.toMatchObject({ success: true });
    expect((await service.getById(post.id, viewer)).canEdit).toBe(true);
    expect(prisma.companyMember.findUnique).not.toHaveBeenCalled();
  });

  it('does not grant a company owner control of someone else\'s personal post', async () => {
    const { service, prisma, post } = postsHarness();
    prisma.post.findUnique.mockResolvedValue({ ...post, companyId: null });
    prisma.companyMember.findUnique.mockResolvedValue(activeSeat());
    await expect(service.update(post.id, user('company-owner'), { content: 'Changed' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.companyMember.findUnique).not.toHaveBeenCalled();
  });

  it('keeps removed posts inaccessible before looking up edit authority', async () => {
    const { service, prisma, post } = postsHarness();
    prisma.post.findUnique.mockResolvedValue({ ...post, removedAt: NOW });
    await expect(service.getById(post.id, user(post.authorId))).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.companyMember.findUnique).not.toHaveBeenCalled();
  });

  it('batches current company seats once for a mixed feed page', async () => {
    const { service, prisma, post } = postsHarness();
    prisma.post.findMany.mockResolvedValue([
      post, { ...post, id: 'same-company-second-post' },
      { ...post, id: 'company-b-post', companyId: 'company-b' },
      { ...post, id: 'my-personal-post', companyId: null, authorId: 'current-viewer' },
      { ...post, id: 'other-personal-post', companyId: null },
    ]);
    prisma.companyMember.findMany.mockResolvedValue([{ companyId: 'company-a' }]);
    const result = await service.list({}, 'current-viewer');
    expect(result.data.map((card) => card.canEdit)).toEqual([true, true, false, true, false]);
    expect(prisma.companyMember.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.companyMember.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'current-viewer', companyId: { in: ['company-a', 'company-b'] },
        status: CompanyMemberStatus.ACTIVE, role: { in: [CompanyRole.OWNER, CompanyRole.ADMIN] },
      },
      select: { companyId: true },
    });
    expect(prisma.companyMember.findUnique).not.toHaveBeenCalled();
  });

  it('hides company controls from the historical author after their seat is gone', async () => {
    const { service } = postsHarness();
    expect((await service.list({}, 'original-author')).data[0].canEdit).toBe(false);
  });

  it('shows no edit controls or membership lookup to an anonymous reader', async () => {
    const { service, prisma } = postsHarness();
    expect((await service.list({})).data[0].canEdit).toBe(false);
    expect(prisma.companyMember.findMany).not.toHaveBeenCalled();
  });

  it('does not query company membership for personal-only pages', async () => {
    const { service, prisma, post } = postsHarness();
    prisma.post.findMany.mockResolvedValue([{ ...post, companyId: null }]);
    expect((await service.list({}, 'original-author')).data[0].canEdit).toBe(true);
    expect(prisma.companyMember.findMany).not.toHaveBeenCalled();
  });

  it('includes current edit authority when a company post is created', async () => {
    const { service, prisma } = postsHarness();
    prisma.companyMember.findMany.mockResolvedValue([{ companyId: 'company-a' }]);
    expect((await service.create('original-author', {
      content: 'Company announcement', spaceId: 'space-a', asCompany: true,
    })).data.canEdit).toBe(true);
  });

  it('includes personal author authority when a post is reshared', async () => {
    const { service, prisma } = postsHarness();
    expect((await service.reshare('post-a', 'original-author', 'Sharing this')).data).toMatchObject({
      authorId: 'original-author', canEdit: true,
    });
    expect(prisma.companyMember.findMany).not.toHaveBeenCalled();
  });
});

describe('Phase 1 company Tides: current seat authority', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(NOW); });
  afterEach(() => jest.useRealTimers());

  it.each([CompanyRole.OWNER, CompanyRole.ADMIN])('lets a current %s edit and cancel a former colleague\'s company Tide', async (role) => {
    const { service, prisma, context } = tidesHarness();
    prisma.companyMember.findUnique.mockResolvedValue(activeSeat(role));
    const updated = await service.update('tide-a', 'current-teammate', { title: 'Updated company event' });
    expect(updated).toMatchObject({ hostId: 'original-host', companyId: 'company-a', title: 'Updated company event' });
    const canceled = await service.cancel('tide-a', 'current-teammate', { reason: ' Rescheduled ' });
    expect(canceled).toMatchObject({ hostId: 'original-host', companyId: 'company-a', canceledAt: NOW, cancelReason: 'Rescheduled' });
    expect(prisma.companyMember.findUnique).toHaveBeenCalledWith({
      where: { companyId_userId: { companyId: 'company-a', userId: 'current-teammate' } },
      select: { role: true, status: true },
    });
    expect(context.forUser).not.toHaveBeenCalled();
  });

  it.each(deniedSeats)('refuses the original host when their seat is $label', async ({ seat }) => {
    const { service, prisma } = tidesHarness();
    prisma.companyMember.findUnique.mockResolvedValue(seat);
    await expect(service.update('tide-a', 'original-host', { title: 'Unauthorized' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.cancel('tide-a', 'original-host', {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.tide.update).not.toHaveBeenCalled();
  });

  it('refuses an owner of another company', async () => {
    const { service, prisma, context } = tidesHarness();
    context.forUser.mockResolvedValue({ companyId: 'company-b', role: CompanyRole.OWNER });
    prisma.companyMember.findUnique.mockImplementation(async ({ where }) =>
      where.companyId_userId.companyId === 'company-b' ? activeSeat() : null);
    await expect(service.cancel('tide-a', 'company-b-owner', {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.tide.update).not.toHaveBeenCalled();
  });

  it('rechecks authority even for an already canceled company Tide', async () => {
    const { service, prisma, tide } = tidesHarness();
    prisma.tide.findUnique.mockResolvedValue({ ...tide, canceledAt: NOW });
    await expect(service.cancel(tide.id, tide.hostId, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.tide.update).not.toHaveBeenCalled();
  });

  it('refuses a new mutation after the company host is suspended', async () => {
    const { service, prisma } = tidesHarness();
    prisma.companyMember.findUnique.mockResolvedValueOnce(activeSeat())
      .mockResolvedValue({ role: CompanyRole.OWNER, status: CompanyMemberStatus.SUSPENDED });
    await service.update('tide-a', 'original-host', { title: 'Allowed while active' });
    await expect(service.cancel('tide-a', 'original-host', {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.tide.update).toHaveBeenCalledTimes(1);
  });

  it('preserves personal-host authority without requiring a company membership', async () => {
    const { service, prisma, tide } = tidesHarness();
    prisma.tide.findUnique.mockResolvedValue({ ...tide, companyId: null });
    await expect(service.update(tide.id, tide.hostId, { title: 'Personal update' })).resolves.toBeDefined();
    await expect(service.cancel(tide.id, tide.hostId, {})).resolves.toBeDefined();
    expect(prisma.companyMember.findUnique).not.toHaveBeenCalled();
  });

  it('does not grant company ownership control of someone else\'s personal Tide', async () => {
    const { service, prisma, tide } = tidesHarness();
    prisma.tide.findUnique.mockResolvedValue({ ...tide, companyId: null });
    prisma.companyMember.findUnique.mockResolvedValue(activeSeat());
    await expect(service.cancel(tide.id, 'company-owner', {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.companyMember.findUnique).not.toHaveBeenCalled();
  });
});
