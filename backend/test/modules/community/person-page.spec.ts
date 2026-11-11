import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PeopleFollowService } from '../../../src/community/people-follow.service';
import { ModerationService } from '../../../src/community/moderation.service';
import { PostsService } from '../../../src/community/posts/posts.service';
import { User } from '../../../src/common/types/user.types';

/**
 * Someone's community page, as on X: tabs for their posts, replies, media and
 * collaborations; "Followed by people you follow"; when they joined; and a
 * way to report them.
 */

const ME = 'aaaaaaaa-0000-4000-8000-000000000001';
const BUNI = 'aaaaaaaa-0000-4000-8000-0000000000b0';
const ADA = 'aaaaaaaa-0000-4000-8000-0000000000ad';

describe('"Followed by people you follow"', () => {
  const service = (recent: unknown[] = [], total = 0) => {
    const prisma = { userFollow: { findMany: jest.fn().mockResolvedValue(recent), count: jest.fn().mockResolvedValue(total) } };
    return { svc: new PeopleFollowService(prisma as never, {} as never, {} as never), prisma };
  };

  it('is nothing signed out, or on your own page', async () => {
    const { svc, prisma } = service();
    await expect(svc.followedByPeopleYouFollow(null, BUNI)).resolves.toBeNull();
    await expect(svc.followedByPeopleYouFollow(BUNI, BUNI)).resolves.toBeNull();
    expect(prisma.userFollow.findMany).not.toHaveBeenCalled();
  });

  it("asks only among people you follow — never you, never a closed account — and names three", async () => {
    const { svc, prisma } = service([{ follower: { id: ADA, displayName: 'Ada Lovelace', firstName: null, lastName: null, avatarUrl: null } }], 4);
    await expect(svc.followedByPeopleYouFollow(ME, BUNI)).resolves.toEqual({ total: 4, people: [{ id: ADA, name: 'Ada Lovelace', avatarUrl: null }] });
    const { where, take } = prisma.userFollow.findMany.mock.calls[0][0];
    expect(take).toBe(3);
    expect(where).toEqual(expect.objectContaining({
      followingId: BUNI,
      followerId: { not: ME },
      follower: expect.objectContaining({ followers: { some: { followerId: ME } }, status: { notIn: expect.any(Array) } }),
    }));
  });
});

describe('The Replies tab', () => {
  const service = (status = 'ACTIVE') => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ status }) },
      postComment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'c1', content: 'Great point', createdAt: new Date('2026-11-09T10:00:00Z'), parentId: 'c0',
            post: {
              id: 'p1', content: `Hiring a designer, ask @[Ada Lovelace](person:${ADA})`, documentTitle: null, mediaUrls: [],
              author: { displayName: 'Patrick Potika', firstName: null, lastName: null }, company: { name: 'Acme' },
            },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    return { svc: new PeopleFollowService(prisma as never, {} as never, {} as never), prisma };
  };

  it('lists what they said and on whose post, mentions read as names', async () => {
    const { svc, prisma } = service();
    const out = await svc.replies(BUNI, 1, 20);
    expect(out.data[0]).toEqual({
      id: 'c1', content: 'Great point', createdAt: new Date('2026-11-09T10:00:00Z'), isReplyToComment: true,
      post: { id: 'p1', by: 'Acme', excerpt: 'Hiring a designer, ask @Ada Lovelace' },
    });
    // Only replies still up, on posts still up.
    expect(prisma.postComment.findMany.mock.calls[0][0].where).toEqual({ authorId: BUNI, removedAt: null, post: { removedAt: null } });
  });

  it("is not there for a closed account", async () => {
    await expect(service('SUSPENDED').svc.replies(BUNI)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('The Media and Collaborations tabs', () => {
  const where = async (view: 'media' | 'collaborations') => {
    const count = jest.fn().mockResolvedValue(0);
    const svc = Object.assign(Object.create(PostsService.prototype), { prisma: { post: { count } } }) as PostsService;
    await svc.countNewer({ authorId: BUNI, view }, '2026-11-09T10:00:00.000Z');
    return count.mock.calls[0][0].where;
  };

  it('Media: their posts with pictures, video or a document', async () => {
    expect((await where('media')).AND).toContainEqual({ OR: [{ mediaUrls: { isEmpty: false } }, { documentUrl: { not: null } }] });
  });

  it('Collaborations: only the posts they were asked onto', async () => {
    expect((await where('collaborations')).AND).toEqual([{ collaborators: { some: { userId: BUNI, status: 'ACCEPTED' } } }]);
  });
});

describe('Reporting a person', () => {
  const REPORTER = { id: ME, role: 'JOB_SEEKER' } as User;
  const moderation = (person: unknown = { id: BUNI, status: 'ACTIVE' }, actorRole = 'ADMIN', spaces: unknown[] = [{ space_id: 's1' }]) => {
    const prisma: Record<string, unknown> = {
      user: { findUnique: jest.fn(({ select }) => Promise.resolve(select?.role ? { role: actorRole, status: 'ACTIVE' } : person)) },
      postReport: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ personId: BUNI, postId: null, comment: null }),
        update: jest.fn().mockResolvedValue({}),
      },
      $queryRaw: jest.fn().mockResolvedValue(spaces),
    };
    prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
    return { svc: new ModerationService(prisma as never, {} as never), prisma: prisma as never as { postReport: { upsert: jest.Mock; update: jest.Mock } } };
  };

  it('files one report per reporter, never about yourself or a closed account', async () => {
    const { svc, prisma } = moderation();
    await expect(svc.reportPerson(REPORTER, BUNI, 'harassment' as never, ' keeps messaging ')).resolves.toEqual({ reported: true });
    expect(prisma.postReport.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { personId_reporterId: { personId: BUNI, reporterId: ME } },
      create: expect.objectContaining({ personId: BUNI, detail: 'keeps messaging' }),
    }));
    await expect(svc.reportPerson(REPORTER, ME, 'spam' as never)).rejects.toBeInstanceOf(BadRequestException);
    await expect(moderation({ id: BUNI, status: 'BANNED' }).svc.reportPerson(REPORTER, BUNI, 'spam' as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('is closed by a platform admin, saying what was done — never by a space moderator', async () => {
    const admin = moderation();
    await admin.svc.markPersonReportHandled({ id: 'admin' } as User, 'r1', 'Warned them');
    expect(admin.prisma.postReport.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIONED', resolution: 'Warned them' }) }));
    await expect(admin.svc.markPersonReportHandled({ id: 'admin' } as User, 'r1', '  ')).rejects.toBeInstanceOf(BadRequestException);

    const spaceMod = moderation(undefined, 'JOB_SEEKER');
    await expect(spaceMod.svc.markPersonReportHandled({ id: 'mod' } as User, 'r1', 'Warned them')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(spaceMod.svc.dismissReport({ id: 'mod' } as User, 'r1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(spaceMod.prisma.postReport.update).not.toHaveBeenCalled();
  });
});
