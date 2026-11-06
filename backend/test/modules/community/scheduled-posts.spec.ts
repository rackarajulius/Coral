import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompanyMemberStatus, CompanyRole, ScheduledPostStatus } from '@prisma/client';
import { ScheduledPostsService } from '../../../src/community/scheduled-posts/scheduled-posts.service';

/**
 * Scheduled posts: written now, published later by the same path as pressing
 * Post — a company's by someone who still speaks for the company then, a
 * personal one by its author, and seen by nobody else.
 */

function collaborator<T>(value: unknown): T { return value as T; }

const ADMIN = 'page-admin';
const OUTSIDER = 'outsider';
const COMPANY = 'company-a';
const HOUR = 60 * 60 * 1000;
const inHours = (h: number) => new Date(Date.now() + h * HOUR).toISOString();

function harness() {
  const seats: Record<string, { role: CompanyRole; status: CompanyMemberStatus }> = {
    [ADMIN]: { role: CompanyRole.ADMIN, status: CompanyMemberStatus.ACTIVE },
  };
  const prisma = {
    companyMember: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        const seat = where.companyId_userId.companyId === COMPANY ? seats[where.companyId_userId.userId] : undefined;
        return seat ? { ...seat, user: { status: 'ACTIVE' } } : null;
      }),
    },
    scheduledPost: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }) => ({
        id: 'sched-1', status: ScheduledPostStatus.SCHEDULED, failureReason: null, createdAt: new Date(),
        author: { id: data.authorId, displayName: null, firstName: 'Pat', lastName: 'Admin', avatarUrl: null },
        ...data,
      })),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn().mockImplementation(async ({ data }) => ({
        id: 'sched-1', companyId: COMPANY, authorId: ADMIN, publishAt: new Date(), payload: { content: 'x' },
        status: ScheduledPostStatus.SCHEDULED, failureReason: null, createdAt: new Date(),
        author: { id: ADMIN, displayName: null, firstName: 'Pat', lastName: 'Admin', avatarUrl: null },
        ...data,
      })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn(),
    },
    // The company and its one page (Company.pageId), which the failure links to.
    company: { findUnique: jest.fn().mockResolvedValue({ name: 'Acme', page: { id: 'page-1', visibility: 'public' } }) },
  };
  const posts = {
    checkDraft: jest.fn().mockResolvedValue({ companyId: COMPANY }),
    create: jest.fn().mockResolvedValue({ data: { id: 'post-1' } }),
  };
  const notifications = { create: jest.fn() };
  const media = { documentPagesFor: jest.fn().mockReturnValue(null) };
  const service = new ScheduledPostsService(collaborator(prisma), collaborator(posts), collaborator(media), collaborator(notifications));
  return { service, prisma, posts, notifications, seats };
}

describe('Scheduling a post', () => {
  it('works for a post in your own name, kept with no company in it', async () => {
    const { service, prisma, posts } = harness();
    posts.checkDraft.mockResolvedValue({ companyId: null });
    const result = await service.schedule(OUTSIDER, { content: 'Hello', publishAt: inHours(2) } as never);
    expect(posts.checkDraft).toHaveBeenCalledWith(OUTSIDER, expect.not.objectContaining({ asCompany: true }));
    const data = prisma.scheduledPost.create.mock.calls[0][0].data;
    expect(data).toEqual(expect.objectContaining({ companyId: null, authorId: OUTSIDER }));
    expect(data.payload).toEqual({ content: 'Hello' });
    expect(result).toEqual(expect.objectContaining({ companyId: null, content: 'Hello' }));
    // Counted against the author's own queue, not a company's.
    expect(prisma.scheduledPost.count).toHaveBeenCalledWith({
      where: { authorId: OUTSIDER, companyId: null, status: ScheduledPostStatus.SCHEDULED },
    });
  });

  it('never turns a company post into a personal one', async () => {
    const { service, prisma, posts } = harness();
    posts.checkDraft.mockResolvedValue({ companyId: null });
    await expect(service.schedule(OUTSIDER, { content: 'Hi', asCompany: true, publishAt: inHours(2) } as never))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.scheduledPost.create).not.toHaveBeenCalled();
  });

  it('keeps announcements of listings to posting now', async () => {
    const { service } = harness();
    await expect(service.schedule(ADMIN, { content: 'Hi', reference: { type: 'service', id: 's' }, publishAt: inHours(2) } as never))
      .rejects.toThrow('while the listing is open');
  });

  it('between ten minutes and ninety days ahead', async () => {
    const { service } = harness();
    await expect(service.schedule(ADMIN, { content: 'Hi', asCompany: true, publishAt: new Date(Date.now() + 60_000).toISOString() } as never))
      .rejects.toThrow('at least 10 minutes');
    await expect(service.schedule(ADMIN, { content: 'Hi', asCompany: true, publishAt: inHours(24 * 91) } as never))
      .rejects.toThrow('90 days');
  });

  it("runs every check a post gets now, and keeps the post as it will be created", async () => {
    const { service, prisma, posts } = harness();
    const result = await service.schedule(ADMIN, { content: 'Launch day', asCompany: true, publishAt: inHours(3) } as never);
    expect(posts.checkDraft).toHaveBeenCalledWith(ADMIN, expect.objectContaining({ content: 'Launch day', asCompany: true }));
    expect(prisma.scheduledPost.create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      companyId: COMPANY,
      authorId: ADMIN,
      payload: expect.objectContaining({ content: 'Launch day', asCompany: true, companyId: COMPANY }),
    }));
    expect(result).toEqual(expect.objectContaining({ content: 'Launch day', author: expect.objectContaining({ name: 'Pat Admin' }) }));
  });

  it('refuses what the post itself would be refused, before keeping anything', async () => {
    const { service, prisma, posts } = harness();
    posts.checkDraft.mockRejectedValue(new ForbiddenException('Only a current company owner or admin can publish in its name.'));
    await expect(service.schedule(OUTSIDER, { content: 'Hi', asCompany: true, publishAt: inHours(2) } as never))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.scheduledPost.create).not.toHaveBeenCalled();
  });

  it('keeps a queue, not a backlog', async () => {
    const { service, prisma, posts } = harness();
    prisma.scheduledPost.count.mockResolvedValue(100);
    await expect(service.schedule(ADMIN, { content: 'Hi', asCompany: true, publishAt: inHours(2) } as never))
      .rejects.toThrow('up to 100');
    prisma.scheduledPost.count.mockResolvedValue(25);
    posts.checkDraft.mockResolvedValue({ companyId: null });
    await expect(service.schedule(OUTSIDER, { content: 'Hi', publishAt: inHours(2) } as never))
      .rejects.toThrow('up to 25 posts of your own');
  });
});

describe('The queue', () => {
  it("is shown only to the page's owners and admins", async () => {
    const { service } = harness();
    await expect(service.listForCompany(OUTSIDER, COMPANY)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listForCompany(ADMIN, COMPANY)).resolves.toEqual([]);
  });

  it("is not found by anyone outside the page, rather than refused", async () => {
    const { service, prisma } = harness();
    prisma.scheduledPost.findUnique.mockResolvedValue({ id: 'sched-1', companyId: COMPANY, authorId: ADMIN, status: ScheduledPostStatus.SCHEDULED });
    await expect(service.cancel(OUTSIDER, 'sched-1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.cancel(ADMIN, 'sched-1')).resolves.toEqual({ id: 'sched-1', canceled: true });
  });

  it("lists your own posts for you alone, and a personal post is yours alone to change", async () => {
    const { service, prisma } = harness();
    await service.listMine(OUTSIDER);
    expect(prisma.scheduledPost.findMany.mock.calls[0][0].where).toEqual(expect.objectContaining({ authorId: OUTSIDER, companyId: null }));

    prisma.scheduledPost.findUnique.mockResolvedValue({ id: 'sched-1', companyId: null, authorId: OUTSIDER, status: ScheduledPostStatus.SCHEDULED });
    // Not even an admin of some company sees someone's own post.
    await expect(service.cancel(ADMIN, 'sched-1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.cancel(OUTSIDER, 'sched-1')).resolves.toEqual({ id: 'sched-1', canceled: true });
    expect(prisma.companyMember.findUnique).not.toHaveBeenCalled();
  });

  it("new words are checked as their writer's, whoever changes them", async () => {
    const { service, prisma, posts } = harness();
    prisma.scheduledPost.findUnique.mockResolvedValue({
      id: 'sched-1', companyId: COMPANY, authorId: 'original-writer', status: ScheduledPostStatus.SCHEDULED, payload: { content: 'Old', asCompany: true },
    });
    await service.update(ADMIN, 'sched-1', { content: 'New words' });
    expect(posts.checkDraft).toHaveBeenCalledWith('original-writer', expect.objectContaining({ content: 'New words' }));
  });

  it('a failed post goes back in the queue only with a new time', async () => {
    const { service, prisma } = harness();
    prisma.scheduledPost.findUnique.mockResolvedValue({
      id: 'sched-1', companyId: COMPANY, authorId: ADMIN, status: ScheduledPostStatus.FAILED, payload: { content: 'x' },
    });
    await expect(service.update(ADMIN, 'sched-1', { content: 'y' })).rejects.toBeInstanceOf(BadRequestException);
    await service.update(ADMIN, 'sched-1', { publishAt: inHours(5) });
    expect(prisma.scheduledPost.update.mock.calls[0][0].data).toEqual(expect.objectContaining({
      status: ScheduledPostStatus.SCHEDULED, failureReason: null,
    }));
  });
});

describe('Publishing what is due', () => {
  const due = { id: 'sched-1', companyId: COMPANY, authorId: ADMIN, payload: { content: 'Launch day', asCompany: true } };

  it('creates it the ordinary way, as its writer, in the company name', async () => {
    const { service, prisma, posts } = harness();
    prisma.scheduledPost.findMany.mockResolvedValue([due]);
    await service.publishDue();
    expect(posts.create).toHaveBeenCalledWith(ADMIN, expect.objectContaining({ content: 'Launch day', asCompany: true, companyId: COMPANY }));
    expect(prisma.scheduledPost.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: ScheduledPostStatus.PUBLISHED, postId: 'post-1' }),
    }));
  });

  it("publishes a personal one in its author's own name, whatever the stored post says", async () => {
    const { service, prisma, posts } = harness();
    prisma.scheduledPost.findMany.mockResolvedValue([
      { id: 'sched-2', companyId: null, authorId: OUTSIDER, payload: { content: 'Mine', asCompany: true, companyId: COMPANY } },
    ]);
    await service.publishDue();
    expect(posts.create).toHaveBeenCalledWith(OUTSIDER, { content: 'Mine' });
  });

  it("tells the author when a personal one could not go out, and where to find it", async () => {
    const { service, prisma, posts, notifications } = harness();
    prisma.scheduledPost.findMany.mockResolvedValue([{ id: 'sched-2', companyId: null, authorId: OUTSIDER, payload: { content: 'Mine' } }]);
    posts.create.mockRejectedValue(new BadRequestException('That space is closed.'));
    await service.publishDue();
    expect(prisma.company.findUnique).not.toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: OUTSIDER, title: "Your scheduled post wasn't published", message: 'That space is closed.', link: '/community?scheduled=1',
    }));
  });

  it('takes each one before creating it, so it cannot go out twice', async () => {
    const { service, prisma, posts } = harness();
    prisma.scheduledPost.findMany.mockResolvedValue([due]);
    prisma.scheduledPost.updateMany.mockImplementation(async ({ where }) =>
      ({ count: where.id ? 0 : 0 }));
    await service.publishDue();
    expect(posts.create).not.toHaveBeenCalled();
  });

  it("does not go out for someone who no longer speaks for the company, and says so to them", async () => {
    const { service, prisma, posts, notifications } = harness();
    prisma.scheduledPost.findMany.mockResolvedValue([due]);
    posts.create.mockRejectedValue(new ForbiddenException('Only a current company owner or admin can publish in its name.'));
    await service.publishDue();
    expect(prisma.scheduledPost.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: ScheduledPostStatus.FAILED, failureReason: 'Only a current company owner or admin can publish in its name.' },
    }));
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: ADMIN,
      title: "A scheduled post for Acme wasn't published",
      link: '/community/companies/page-1',
    }));
  });

  it('reports a run that died mid-way as a failure, not a retry', async () => {
    const { service, prisma } = harness();
    await service.publishDue(new Date('2026-11-01T12:00:00Z'));
    expect(prisma.scheduledPost.updateMany).toHaveBeenCalledWith({
      where: { status: ScheduledPostStatus.PUBLISHING, updatedAt: { lt: new Date('2026-11-01T11:45:00Z') } },
      data: { status: ScheduledPostStatus.FAILED, failureReason: expect.stringContaining('interrupted') },
    });
  });
});
