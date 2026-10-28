import { ForbiddenException } from '@nestjs/common';
import { CompanyMemberStatus, CompanyRole } from '@prisma/client';
import { PostStatsService } from '../../../src/community/post-stats/post-stats.service';
import { PostsService } from '../../../src/community/posts/posts.service';

/**
 * Post stats: views counted honestly, and told only to whoever may manage the post.
 */

function collaborator<T>(value: unknown): T { return value as T; }
const user = (id: string) => collaborator<Parameters<PostStatsService['recordViews']>[0]>({ id });

const READER = 'reader';
const AUTHOR = 'author';
const TEAMMATE = 'teammate';
const COMPANY = 'company-a';
const P = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

describe('Recording views', () => {
  function harness(viewer: string) {
    const posts = [
      { id: P(1), authorId: AUTHOR, companyId: null },
      { id: P(2), authorId: AUTHOR, companyId: COMPANY },
    ];
    const prisma = {
      post: {
        findMany: jest.fn().mockImplementation(async ({ where }) =>
          posts.filter((p) => where.id.in.includes(p.id) && p.authorId !== where.authorId.not)),
      },
      companyMember: {
        findMany: jest.fn().mockImplementation(async ({ where }) =>
          where.userId === TEAMMATE && where.status === CompanyMemberStatus.ACTIVE ? [{ companyId: COMPANY }] : []),
      },
      $queryRaw: jest.fn().mockImplementation(async (_sql: TemplateStringsArray, ids: string[]) => ids.map((id) => ({ post_id: id }))),
      $executeRaw: jest.fn(),
    };
    return { service: new PostStatsService(collaborator(prisma)), prisma, viewer: user(viewer) };
  }

  it('counts a reader once per post per day, and adds only new views to the total', async () => {
    const { service, prisma, viewer } = harness(READER);
    await expect(service.recordViews(viewer, [P(1), P(2), P(1)])).resolves.toEqual({ counted: 2 });
    const [, ids, viewerId, day] = prisma.$queryRaw.mock.calls[0];
    expect(ids).toEqual([P(1), P(2)]);
    expect(viewerId).toBe(READER);
    expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(prisma.$executeRaw.mock.calls[0][1]).toEqual([P(1), P(2)]);
  });

  it("never counts the author, nor the company's own team on its posts", async () => {
    const author = harness(AUTHOR);
    await expect(author.service.recordViews(author.viewer, [P(1), P(2)])).resolves.toEqual({ counted: 0 });
    expect(author.prisma.$queryRaw).not.toHaveBeenCalled();

    const teammate = harness(TEAMMATE);
    await teammate.service.recordViews(teammate.viewer, [P(1), P(2)]);
    expect(teammate.prisma.$queryRaw.mock.calls[0][1]).toEqual([P(1)]);
  });

  it('ignores anything that is not a post id', async () => {
    const { service, prisma, viewer } = harness(READER);
    await expect(service.recordViews(viewer, ["1' OR 1=1", ''])).resolves.toEqual({ counted: 0 });
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });
});

describe("A post's stats", () => {
  function harness(post: Record<string, unknown>, seat?: CompanyRole) {
    const prisma = {
      post: { findUnique: jest.fn().mockResolvedValue(post) },
      companyMember: {
        findUnique: jest.fn().mockResolvedValue(seat ? { role: seat, status: CompanyMemberStatus.ACTIVE, user: { status: 'ACTIVE' } } : null),
      },
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ people: 30 }])
        .mockResolvedValueOnce([{ day: new Date(Date.UTC(2026, 9, 27)), views: 12 }]),
    };
    return new PostStatsService(collaborator(prisma));
  }
  const base = {
    id: P(1), authorId: AUTHOR, companyId: null, removedAt: null, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    viewsCount: 40, likesCount: 3, commentsCount: 2, resharesCount: 1,
  };

  it('are for the author of a personal post', async () => {
    await expect(harness(base).postStats(user(READER), P(1))).rejects.toBeInstanceOf(ForbiddenException);
    const stats = await harness(base).postStats(user(AUTHOR), P(1));
    expect(stats).toEqual(expect.objectContaining({ views: 40, peopleReached: 30, reactions: 3, comments: 2, reshares: 1, engagementRate: 15 }));
    // Every day since it went out, zeros included.
    expect(stats.daily).toHaveLength(4);
  });

  it("are for the people who run the page on a company post — not its author once they've left", async () => {
    const companyPost = { ...base, companyId: COMPANY };
    await expect(harness(companyPost).postStats(user(AUTHOR), P(1))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(harness(companyPost, CompanyRole.RECRUITER).postStats(user(TEAMMATE), P(1))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(harness(companyPost, CompanyRole.ADMIN).postStats(user(TEAMMATE), P(1))).resolves.toEqual(expect.objectContaining({ views: 40 }));
  });

  it('a company page tells nothing to someone who does not run it', async () => {
    await expect(harness(base).companyInsights(user(READER), COMPANY)).resolves.toBeNull();
  });
});

describe('Who sees the view count on a post', () => {
  it('only whoever may manage it', async () => {
    const prisma = {
      postLike: { findMany: jest.fn().mockResolvedValue([]) },
      postBookmark: { findMany: jest.fn().mockResolvedValue([]) },
      companyMember: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const posts = new PostsService(
      collaborator(prisma), collaborator({}), collaborator({}), collaborator({}), collaborator({}),
      collaborator({}), collaborator({}), collaborator({}),
    );
    const flag = (viewer?: string) => (posts as unknown as {
      addViewerFlags(p: unknown[], v?: string): Promise<Array<{ viewsCount?: number }>>;
    }).addViewerFlags([{ id: P(1), authorId: AUTHOR, companyId: null, viewsCount: 40 }], viewer);

    await expect(flag(AUTHOR)).resolves.toEqual([expect.objectContaining({ viewsCount: 40 })]);
    expect((await flag(READER))[0].viewsCount).toBeUndefined();
    expect((await flag())[0].viewsCount).toBeUndefined();
  });
});
