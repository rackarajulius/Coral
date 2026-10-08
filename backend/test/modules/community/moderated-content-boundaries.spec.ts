import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CommentsService } from '../../../src/community/comments/comments.service';
import { PostsService } from '../../../src/community/posts/posts.service';
import { User } from '../../../src/common/types/user.types';

function collaborator<T>(value: unknown): T {
  return value as T;
}

const removedAt = new Date('2026-10-07T09:00:00Z');
const visiblePost = () => ({
  id: 'post-a', authorId: 'author', content: 'Visible discussion',
  removedAt: null as Date | null, comments: [],
});

function postHarness() {
  const prisma = {
    post: {
      findUnique: jest.fn().mockResolvedValue(visiblePost()),
      create: jest.fn(), update: jest.fn().mockResolvedValue({}),
    },
    postLike: { findMany: jest.fn().mockResolvedValue([]) },
    postBookmark: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((work: (tx: typeof prisma) => unknown) => work(prisma));
  const service = new PostsService(
    collaborator(prisma), collaborator({}), collaborator({ resolve: jest.fn().mockResolvedValue(new Map()) }), collaborator({}),
    collaborator({}), collaborator({}), collaborator({}), collaborator({}),
  );
  return { service, prisma };
}

function commentHarness() {
  const prisma = {
    post: {
      findUnique: jest.fn().mockResolvedValue(visiblePost()),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    postComment: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'parent-a', postId: 'post-a', authorId: 'parent-author',
        parentId: null, removedAt: null,
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'comment-a', ...data })),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ displayName: 'Commenter' }) },
    $queryRaw: jest.fn().mockResolvedValue([{ authorId: 'parent-author' }]),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((work: (tx: typeof prisma) => unknown) => work(prisma));
  const notifications = { create: jest.fn().mockResolvedValue(undefined) };
  const identity = { resolve: jest.fn().mockResolvedValue(new Map()) };
  const service = new CommentsService(collaborator(prisma), collaborator(identity), collaborator(notifications));
  return { service, prisma, notifications };
}

describe('Moderated content: public post detail', () => {
  it.each([
    { label: 'anonymous visitor', viewer: undefined },
    { label: 'post author', viewer: { id: 'author', role: UserRole.JOB_SEEKER } as User },
    { label: 'platform administrator', viewer: { id: 'admin', role: UserRole.ADMIN } as User },
  ])('withholds removed text from a $label on the ordinary permalink', async ({ viewer }) => {
    const { service, prisma } = postHarness();
    prisma.post.findUnique.mockResolvedValue({ ...visiblePost(), removedAt, content: 'Removed text' });
    await expect(service.getById('post-a', viewer)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.postLike.findMany).not.toHaveBeenCalled();
  });

  it('uses the same unavailable response for a nonexistent post', async () => {
    const { service, prisma } = postHarness();
    prisma.post.findUnique.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toThrow('Post not found');
  });

  it('does not expose removed original text through a still-visible reshare', async () => {
    const { service, prisma } = postHarness();
    const original = { id: 'original-a', content: 'Removed original text', removedAt };
    prisma.post.findUnique.mockResolvedValue({ ...visiblePost(), resharedFrom: original });
    await expect(service.getById('post-a')).resolves.toMatchObject({
      content: 'Visible discussion', resharedFrom: null,
    });
    expect(original.content).toBe('Removed original text');
  });

  it('keeps an eligible original embedded in a visible reshare', async () => {
    const { service, prisma } = postHarness();
    prisma.post.findUnique.mockResolvedValue({
      ...visiblePost(), resharedFrom: { id: 'original-a', content: 'Visible original', removedAt: null },
    });
    await expect(service.getById('post-a')).resolves.toMatchObject({
      resharedFrom: { content: 'Visible original' },
    });
  });

  it('redacts the create-reshare response when the original is removed after its initial lookup', async () => {
    const { service, prisma } = postHarness();
    prisma.post.create.mockResolvedValue({
      ...visiblePost(), id: 'reshare-a', resharedFrom: {
        id: 'post-a', removedAt, content: 'Removed original text',
      },
    });
    await expect(service.reshare('post-a', 'author', 'My words')).resolves.toMatchObject({
      success: true, data: { id: 'reshare-a', resharedFrom: null },
    });
  });

  it('keeps visible and restored posts readable and filters removed discussion at both levels', async () => {
    const { service, prisma } = postHarness();
    await expect(service.getById('post-a')).resolves.toMatchObject({ content: 'Visible discussion' });
    const query = prisma.post.findUnique.mock.calls[0][0];
    expect(query.include.comments.where).toEqual({ parentId: null, removedAt: null });
    expect(query.include.comments.include.replies.where).toEqual({ removedAt: null });
  });
});

describe('Moderated content: comment endpoints', () => {
  it.each([null, { ...visiblePost(), removedAt }])('does not list comments for an unavailable post', async (post) => {
    const { service, prisma } = commentHarness();
    prisma.post.findUnique.mockResolvedValue(post);
    await expect(service.listByPost('post-a', {})).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.postComment.findMany).not.toHaveBeenCalled();
  });

  it.each([null, { ...visiblePost(), removedAt }])('rejects new comments before writing to an unavailable post', async (post) => {
    const { service, prisma, notifications } = commentHarness();
    prisma.post.findUnique.mockResolvedValue(post);
    await expect(service.create('post-a', 'commenter', { content: 'New comment' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.postComment.create).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('rejects a reply whose parent comment was removed', async () => {
    const { service, prisma } = commentHarness();
    prisma.postComment.findUnique.mockResolvedValue({
      id: 'parent-a', postId: 'post-a', parentId: null, authorId: 'parent-author', removedAt,
    });
    await expect(service.create('post-a', 'commenter', { parentId: 'parent-a', content: 'Reply' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses a stale comment when removal wins between the first read and the transaction', async () => {
    const { service, prisma, notifications } = commentHarness();
    prisma.post.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.create('post-a', 'commenter', { content: 'Stale comment' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.postComment.create).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('rechecks a reply target under a database lock before writing or notifying', async () => {
    const { service, prisma, notifications } = commentHarness();
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(service.create('post-a', 'commenter', { parentId: 'parent-a', content: 'Stale reply' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.post.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.postComment.create).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('retains normal comment creation and increments the active parent within the same transaction', async () => {
    const { service, prisma } = commentHarness();
    // The author commenting on their own post does not need an external notification.
    const result = await service.create('post-a', 'author', { content: '  Visible comment  ' });
    expect(result.data).toMatchObject({ content: 'Visible comment', postId: 'post-a', authorId: 'author' });
    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: { id: 'post-a', removedAt: null }, data: { commentsCount: { increment: 1 } },
    });
    expect(prisma.postComment.create).toHaveBeenCalledTimes(1);
    expect(prisma.post.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(prisma.postComment.create.mock.invocationCallOrder[0]);
  });

  it('locks the post before the reply target and notifies after a successful commit', async () => {
    const { service, prisma, notifications } = commentHarness();
    await expect(service.create('post-a', 'commenter', { parentId: 'parent-a', content: 'Reply' }))
      .resolves.toMatchObject({ success: true });
    await Promise.resolve();
    expect(prisma.post.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(prisma.$queryRaw.mock.invocationCallOrder[0]);
    expect(prisma.$queryRaw.mock.invocationCallOrder[0])
      .toBeLessThan(prisma.postComment.create.mock.invocationCallOrder[0]);
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'parent-author' }));
  });

  it('retains an empty visible discussion with accurate pagination', async () => {
    const { service } = commentHarness();
    await expect(service.listByPost('post-a', {})).resolves.toMatchObject({
      data: [], meta: { total: 0, totalPages: 1 },
    });
  });
});
