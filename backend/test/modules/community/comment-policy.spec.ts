import { ForbiddenException } from '@nestjs/common';
import { CommentPolicy, CompanyMemberStatus } from '@prisma/client';
import { assertMayComment, commentAccess, PolicyPost } from '../../../src/community/comment-policy';
import { CommentsService } from '../../../src/community/comments/comments.service';

/**
 * Who may comment on a community post: anyone, followers only, or nobody —
 * one rule for the comment box and the server alike.
 */

function collaborator<T>(value: unknown): T { return value as T; }

const AUTHOR = 'author-a';
const FAN = 'follows-author';
const STRANGER = 'stranger';
const COMPANY = 'company-a';
const COMPANY_FAN = 'follows-company';
const TEAMMATE = 'on-the-team';

function reader() {
  return {
    userFollow: {
      findMany: jest.fn().mockImplementation(async ({ where }) =>
        where.followerId === FAN && where.followingId.in.includes(AUTHOR) ? [{ followingId: AUTHOR }] : []),
    },
    companyFollow: {
      findMany: jest.fn().mockImplementation(async ({ where }) =>
        where.userId === COMPANY_FAN && where.company.companyId.in.includes(COMPANY)
          ? [{ company: { companyId: COMPANY } }]
          : []),
    },
    companyMember: {
      findMany: jest.fn().mockImplementation(async ({ where }) =>
        where.userId === TEAMMATE && where.status === CompanyMemberStatus.ACTIVE ? [{ companyId: COMPANY }] : []),
    },
  };
}

const personal = (commentPolicy: CommentPolicy): PolicyPost =>
  ({ id: `personal-${commentPolicy}`, authorId: AUTHOR, companyId: null, commentPolicy });
const company = (commentPolicy: CommentPolicy): PolicyPost =>
  ({ id: `company-${commentPolicy}`, authorId: AUTHOR, companyId: COMPANY, commentPolicy });

const may = async (post: PolicyPost, viewer?: string) =>
  (await commentAccess(collaborator(reader()), [post], viewer)).get(post.id);

describe('Comment settings', () => {
  it('anyone: everyone who is signed in, and a missing setting means the same', async () => {
    await expect(may(personal(CommentPolicy.ANYONE), STRANGER)).resolves.toBe(true);
    await expect(may({ id: 'old', authorId: AUTHOR }, STRANGER)).resolves.toBe(true);
  });

  it("followers only on a personal post: the author's followers, and the author", async () => {
    await expect(may(personal(CommentPolicy.FOLLOWERS), FAN)).resolves.toBe(true);
    await expect(may(personal(CommentPolicy.FOLLOWERS), AUTHOR)).resolves.toBe(true);
    await expect(may(personal(CommentPolicy.FOLLOWERS), STRANGER)).resolves.toBe(false);
    await expect(may(personal(CommentPolicy.FOLLOWERS))).resolves.toBe(false);
  });

  it("followers only on a company post: the page's followers and the company's own team", async () => {
    await expect(may(company(CommentPolicy.FOLLOWERS), COMPANY_FAN)).resolves.toBe(true);
    await expect(may(company(CommentPolicy.FOLLOWERS), TEAMMATE)).resolves.toBe(true);
    // Following the person who wrote it is not following the company.
    await expect(may(company(CommentPolicy.FOLLOWERS), FAN)).resolves.toBe(false);
  });

  it('off: nobody, the author included', async () => {
    await expect(may(personal(CommentPolicy.OFF), AUTHOR)).resolves.toBe(false);
    await expect(may(company(CommentPolicy.OFF), TEAMMATE)).resolves.toBe(false);
  });

  it('answers a whole page with one query of each kind, and none when nothing is restricted', async () => {
    const prisma = reader();
    await commentAccess(collaborator(prisma), [personal(CommentPolicy.ANYONE), personal(CommentPolicy.OFF)], FAN);
    expect(prisma.userFollow.findMany).not.toHaveBeenCalled();

    await commentAccess(
      collaborator(prisma),
      [personal(CommentPolicy.FOLLOWERS), company(CommentPolicy.FOLLOWERS), { ...personal(CommentPolicy.FOLLOWERS), id: 'p2' }],
      FAN,
    );
    expect(prisma.userFollow.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.companyFollow.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.companyMember.findMany).toHaveBeenCalledTimes(1);
  });

  it('says why when it refuses', async () => {
    await expect(assertMayComment(collaborator(reader()), personal(CommentPolicy.OFF), FAN))
      .rejects.toThrow('Comments are turned off');
    await expect(assertMayComment(collaborator(reader()), company(CommentPolicy.FOLLOWERS), STRANGER))
      .rejects.toThrow('follow this company');
  });
});

describe('The server enforces it on comments and replies', () => {
  function harness(commentPolicy: CommentPolicy) {
    const prisma = {
      ...reader(),
      post: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'post-a', authorId: AUTHOR, companyId: null, commentPolicy, removedAt: null,
        }),
      },
      postComment: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    const service = new CommentsService(collaborator(prisma), collaborator({}), collaborator({}));
    return { service, prisma };
  }

  it('refuses before writing anything, for a reply as much as a comment', async () => {
    for (const parentId of [undefined, 'parent-a']) {
      const { service, prisma } = harness(CommentPolicy.FOLLOWERS);
      await expect(service.create('post-a', STRANGER, { content: 'Hello', parentId } as never))
        .rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  });

  it('lets a follower through to the write', async () => {
    const { service, prisma } = harness(CommentPolicy.FOLLOWERS);
    prisma.$transaction.mockRejectedValue(new Error('reached the write'));
    await expect(service.create('post-a', FAN, { content: 'Hello' } as never)).rejects.toThrow('reached the write');
  });
});
