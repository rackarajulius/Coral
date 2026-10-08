import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CommentsService } from '../src/community/comments/comments.service';
import { PostsService } from '../src/community/posts/posts.service';
import { User } from '../src/common/types/user.types';
import { createTestDatabase } from './support/database';

function collaborator<T>(value: unknown): T {
  return value as T;
}

// Real database/service integration. Identity, media and notification delivery are
// outside this suite; authentication and HTTP routing are not exercised here.
describe('Community moderated-content boundaries (PostgreSQL)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let prisma: PrismaClient;
  let author: User;
  let posts: PostsService;
  let comments: CommentsService;

  beforeAll(async () => {
    database = await createTestDatabase();
    prisma = database.prisma;
    author = await prisma.user.create({ data: {
      supabaseId: randomUUID(), email: `${randomUUID()}@example.test`,
      role: 'JOB_SEEKER', status: 'ACTIVE', displayName: 'Community fixture',
    } });
    posts = new PostsService(
      collaborator(prisma), collaborator({}), collaborator({ resolve: jest.fn().mockResolvedValue(new Map()) }), collaborator({}),
      collaborator({}), collaborator({}), collaborator({}), collaborator({}),
    );
    comments = new CommentsService(collaborator(prisma), collaborator({
      resolve: jest.fn().mockImplementation(async (ids: string[]) =>
        new Map(ids.map((id) => [id, { label: null, verified: false, companyId: null }]))),
    }), collaborator({}));
  });

  afterAll(async () => { if (database) await database.close(); });

  async function post() {
    return prisma.post.create({ data: { authorId: author.id, content: 'Visible fixture post' } });
  }

  it('filters removed top-level comments and replies from actual database results', async () => {
    const parent = await post();
    const top = await prisma.postComment.create({ data: {
      postId: parent.id, authorId: author.id, content: 'Visible comment',
    } });
    await prisma.postComment.create({ data: {
      postId: parent.id, authorId: author.id, content: 'Removed comment', removedAt: new Date(),
    } });
    await prisma.postComment.create({ data: {
      postId: parent.id, authorId: author.id, parentId: top.id, content: 'Visible reply',
    } });
    await prisma.postComment.create({ data: {
      postId: parent.id, authorId: author.id, parentId: top.id,
      content: 'Removed reply', removedAt: new Date(),
    } });

    const detail = await posts.getById(parent.id);
    expect(detail.comments.map((comment) => comment.content)).toEqual(['Visible comment']);
    expect(detail.comments[0].replies.map((reply) => reply.content)).toEqual(['Visible reply']);
    const discussion = await comments.listByPost(parent.id, {});
    expect(discussion.meta.total).toBe(1);
    expect(discussion.data[0].replies.map((reply) => reply.content)).toEqual(['Visible reply']);
  });

  it('removes public access and comment creation, then supports explicit restoration', async () => {
    const parent = await post();
    await comments.create(parent.id, author.id, { content: 'Before moderation' });
    expect((await prisma.post.findUniqueOrThrow({ where: { id: parent.id } })).commentsCount).toBe(1);
    await prisma.post.update({ where: { id: parent.id }, data: { removedAt: new Date() } });

    await expect(posts.getById(parent.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(posts.getById(parent.id, author)).rejects.toBeInstanceOf(NotFoundException);
    await expect(comments.listByPost(parent.id, {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(comments.create(parent.id, author.id, { content: 'After moderation' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(await prisma.postComment.count({ where: { postId: parent.id } })).toBe(1);

    await prisma.post.update({ where: { id: parent.id }, data: { removedAt: null } });
    await expect(posts.getById(parent.id)).resolves.toMatchObject({ id: parent.id });
    await expect(comments.create(parent.id, author.id, { content: 'After restoration' }))
      .resolves.toMatchObject({ success: true });
    expect((await prisma.post.findUniqueOrThrow({ where: { id: parent.id } })).commentsCount).toBe(2);
  });

  it('redacts a removed original from a live reshare without destroying retained moderation evidence', async () => {
    const original = await post();
    const share = await prisma.post.create({ data: {
      authorId: author.id, content: 'My own words', resharedFromId: original.id,
    } });
    await prisma.post.update({ where: { id: original.id }, data: { removedAt: new Date() } });
    await expect(posts.getById(share.id)).resolves.toMatchObject({
      content: 'My own words', resharedFrom: null,
    });
    expect((await prisma.post.findUniqueOrThrow({ where: { id: original.id } })).content)
      .toBe('Visible fixture post');
  });

  it('refuses a reply to a removed comment without changing the parent count', async () => {
    const parent = await post();
    const removed = await prisma.postComment.create({ data: {
      postId: parent.id, authorId: author.id, content: 'Removed parent', removedAt: new Date(),
    } });
    await expect(comments.create(parent.id, author.id, { parentId: removed.id, content: 'Stale reply' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(await prisma.postComment.count({ where: { parentId: removed.id } })).toBe(0);
    expect((await prisma.post.findUniqueOrThrow({ where: { id: parent.id } })).commentsCount).toBe(0);
  });

  it('rolls back a reply when its initial read becomes stale after comment removal', async () => {
    const parent = await post();
    const target = await prisma.postComment.create({ data: {
      postId: parent.id, authorId: author.id, content: 'Initially visible target',
    } });
    const staleReader = new CommentsService(collaborator({
      post: prisma.post, user: prisma.user,
      postComment: { findUnique: async () => {
        await prisma.postComment.update({ where: { id: target.id }, data: { removedAt: new Date() } });
        return target;
      } },
      $transaction: prisma.$transaction.bind(prisma),
    }), collaborator({}), collaborator({}));
    await expect(staleReader.create(parent.id, author.id, { parentId: target.id, content: 'Stale reply' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(await prisma.postComment.count({ where: { parentId: target.id } })).toBe(0);
    expect((await prisma.post.findUniqueOrThrow({ where: { id: parent.id } })).commentsCount).toBe(0);
  });

  it('refuses a new comment when moderation commits after its initial post snapshot', async () => {
    const parent = await post();
    const staleReader = new CommentsService(collaborator({
      post: { findUnique: async () => {
        await prisma.post.update({ where: { id: parent.id }, data: { removedAt: new Date() } });
        return parent;
      } },
      $transaction: prisma.$transaction.bind(prisma),
    }), collaborator({}), collaborator({}));
    await expect(staleReader.create(parent.id, author.id, { content: 'Stale comment' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(await prisma.postComment.count({ where: { postId: parent.id } })).toBe(0);
    expect((await prisma.post.findUniqueOrThrow({ where: { id: parent.id } })).commentsCount).toBe(0);
  });

  it('creates a normal reply and deletes the whole thread with an accurate post counter', async () => {
    const parent = await post();
    const top = await comments.create(parent.id, author.id, { content: 'Parent comment' });
    await comments.create(parent.id, author.id, { parentId: top.data.id, content: 'Reply' });
    expect((await prisma.post.findUniqueOrThrow({ where: { id: parent.id } })).commentsCount).toBe(2);
    await comments.delete(parent.id, top.data.id, author);
    expect(await prisma.postComment.count({ where: { postId: parent.id } })).toBe(0);
    expect((await prisma.post.findUniqueOrThrow({ where: { id: parent.id } })).commentsCount).toBe(0);
  });
});
