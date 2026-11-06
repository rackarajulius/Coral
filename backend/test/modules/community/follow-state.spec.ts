import { followStateFor } from '../../../src/community/follow-state';

/**
 * Follow state sent with a page of posts, so the feed doesn't ask about each
 * company and author afterwards.
 */

function collaborator<T>(value: unknown): T { return value as T; }

const VIEWER = 'viewer';

function prisma(opts: { fail?: boolean } = {}) {
  return {
    companyFollow: {
      groupBy: jest.fn().mockResolvedValue([{ companyId: 'page-a', _count: { _all: 12 } }]),
      findMany: jest.fn().mockResolvedValue([{ companyId: 'page-a' }]),
    },
    userFollow: {
      groupBy: opts.fail
        ? jest.fn().mockRejectedValue(new Error('connection reset'))
        : jest.fn().mockResolvedValue([{ followingId: 'ann', _count: { _all: 3 } }]),
      findMany: jest.fn().mockResolvedValue([{ followingId: 'ann' }]),
    },
  };
}

const posts = [
  { id: 'p1', authorId: 'writer-at-acme', company: { id: 'acme', profiles: [{ id: 'page-a' }] } },
  { id: 'p2', authorId: 'ann', company: null },
  { id: 'p3', authorId: 'ann', company: null },
  { id: 'p4', authorId: 'bob', company: null },
  // A company without a page to follow.
  { id: 'p5', authorId: 'someone', company: { id: 'quiet', profiles: [] } },
];

describe('Follow state on a page of posts', () => {
  it("says, per post, whether you follow its company's page or its author, and how many do", async () => {
    const db = prisma();
    const [acme, ann, ann2, bob, quiet] = await followStateFor(collaborator(db), posts, VIEWER);
    expect(acme).toMatchObject({ companyFollow: { isFollowing: true, followerCount: 12 }, authorFollow: null });
    expect(ann).toMatchObject({ companyFollow: null, authorFollow: { isFollowing: true, followerCount: 3 } });
    expect(ann2.authorFollow).toEqual(ann.authorFollow);
    expect(bob).toMatchObject({ authorFollow: { isFollowing: false, followerCount: 0 } });
    expect(quiet).toMatchObject({ companyFollow: null, authorFollow: null });
  });

  it('asks once for everyone on the page, counting only followers whose accounts are open', async () => {
    const db = prisma();
    await followStateFor(collaborator(db), posts, VIEWER);
    expect(db.companyFollow.groupBy).toHaveBeenCalledTimes(1);
    expect(db.companyFollow.groupBy.mock.calls[0][0].where).toEqual({ companyId: { in: ['page-a'] } });
    expect(db.userFollow.groupBy).toHaveBeenCalledTimes(1);
    const where = db.userFollow.groupBy.mock.calls[0][0].where;
    expect(where.followingId.in.sort()).toEqual(['ann', 'bob']);
    expect(where.follower.status.notIn).toEqual(expect.arrayContaining(['SUSPENDED', 'BANNED']));
  });

  it('signed out: counts, and nobody followed — without asking whom you follow', async () => {
    const db = prisma();
    const [acme, ann] = await followStateFor(collaborator(db), posts);
    expect(acme.companyFollow).toEqual({ isFollowing: false, followerCount: 12 });
    expect(ann.authorFollow).toEqual({ isFollowing: false, followerCount: 3 });
    expect(db.companyFollow.findMany).not.toHaveBeenCalled();
    expect(db.userFollow.findMany).not.toHaveBeenCalled();
  });

  it('never fails the feed: without follow state the page asks per post, as before', async () => {
    const result = await followStateFor(collaborator(prisma({ fail: true })), posts, VIEWER);
    expect(result).toHaveLength(posts.length);
    expect(result.every((p) => p.companyFollow === null && p.authorFollow === null)).toBe(true);
  });
});
