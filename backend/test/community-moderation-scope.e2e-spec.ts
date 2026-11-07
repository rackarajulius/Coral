import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { PrismaClient, UserRole } from '@prisma/client';
import { createTestDatabase } from './support/database';
import { createMarketplaceApp } from './support/marketplace-app';

describe('Community moderation scope (HTTP and PostgreSQL)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let prisma: PrismaClient, app: INestApplication, baseUrl: string;
  beforeAll(async () => {
    database = await createTestDatabase(); prisma = database.prisma;
    ({ app, baseUrl } = await createMarketplaceApp(prisma));
  }, 240_000);
  afterAll(async () => { try { await app?.close(); } finally { await database?.close(); } });
  async function user(role: UserRole = 'JOB_SEEKER') {
    return prisma.user.create({ data: { supabaseId: randomUUID(), email: `${randomUUID()}@example.test`, role, status: 'ACTIVE' } });
  }
  async function request(path: string, actor: string | null, body?: object, expected = 200) {
    const response = await fetch(`${baseUrl}/community/moderation${path}`, {
      method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${actor}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    expect({ status: response.status, error: response.status >= 400 ? result.message : undefined })
      .toMatchObject({ status: expected });
    return result.data;
  }
  async function fixture() {
    const moderator = await user(), author = await user(), admin = await user('ADMIN');
    const own = await prisma.space.create({ data: { name: 'Own QA Space', slug: randomUUID(), members: { create: { userId: moderator.id, role: 'MODERATOR' } } } });
    const foreign = await prisma.space.create({ data: { name: 'Other QA Space', slug: randomUUID() } });
    const targets = [];
    for (const spaceId of [own.id, foreign.id, null]) {
      const post = await prisma.post.create({ data: { authorId: author.id, content: 'Synthetic report target', spaceId } });
      const comment = await prisma.postComment.create({ data: { postId: post.id, authorId: author.id, content: 'Synthetic comment' } });
      const report = await prisma.postReport.create({ data: { postId: post.id, reporterId: moderator.id, reason: 'spam' } });
      const commentReport = await prisma.postReport.create({ data: { commentId: comment.id, reporterId: moderator.id, reason: 'spam' } });
      targets.push({ post, comment, report, commentReport });
    }
    return { moderator, author, admin, own, foreign, targets };
  }

  it('shows only own-Space post/comment reports; administrators retain the global queue', async () => {
    const f = await fixture();
    const reports = await request('/reports', f.moderator.id);
    expect(reports.map((r: { id: string }) => r.id).sort()).toEqual([f.targets[0].report.id, f.targets[0].commentReport.id].sort());
    const global = await request('/reports', f.admin.id);
    for (const target of f.targets) expect(global.map((r: { id: string }) => r.id)).toEqual(expect.arrayContaining([target.report.id, target.commentReport.id]));
    await request('/reports', f.author.id, undefined, 403);
    await request('/reports', null, undefined, 401);
  });

  it('denies copied foreign and unscoped targets for every decision without changing data', async () => {
    const f = await fixture();
    for (const target of f.targets.slice(1)) {
      await request(`/posts/${target.post.id}/remove`, f.moderator.id, { reason: 'QA removal' }, 404);
      await request(`/posts/${target.post.id}/restore`, f.moderator.id, {}, 404);
      await request(`/comments/${target.comment.id}/remove`, f.moderator.id, {}, 404);
      for (const report of [target.report, target.commentReport]) await request(`/reports/${report.id}/dismiss`, f.moderator.id, {}, 404);
      expect((await prisma.post.findUniqueOrThrow({ where: { id: target.post.id } })).removedAt).toBeNull();
      expect((await prisma.postComment.findUniqueOrThrow({ where: { id: target.comment.id } })).removedAt).toBeNull();
      expect((await prisma.postReport.findUniqueOrThrow({ where: { id: target.report.id } })).status).toBe('OPEN');
    }
  });

  it('permits own-Space removal/restoration and records the reviewing actor', async () => {
    const f = await fixture(), target = f.targets[0];
    await request(`/posts/${target.post.id}/remove`, f.moderator.id, { reason: 'QA spam review' }, 201);
    expect(await prisma.postReport.findUniqueOrThrow({ where: { id: target.report.id } })).toMatchObject({ status: 'ACTIONED', reviewedById: f.moderator.id, resolution: 'QA spam review' });
    await request(`/posts/${target.post.id}/restore`, f.moderator.id, {}, 201);
    expect(await prisma.post.findUniqueOrThrow({ where: { id: target.post.id } })).toMatchObject({ removedAt: null, mediaUrls: [] });
    await request(`/comments/${target.comment.id}/remove`, f.moderator.id, {}, 201);
    expect(await prisma.postReport.findUniqueOrThrow({ where: { id: target.commentReport.id } })).toMatchObject({ status: 'ACTIONED', reviewedById: f.moderator.id });
  });

  it('permits scoped dismissal and leaves unscoped decisions to an active platform admin', async () => {
    const f = await fixture();
    await request(`/reports/${f.targets[0].commentReport.id}/dismiss`, f.moderator.id, { resolution: 'Reviewed in context' }, 201);
    expect(await prisma.postReport.findUniqueOrThrow({ where: { id: f.targets[0].commentReport.id } })).toMatchObject({ status: 'DISMISSED', reviewedById: f.moderator.id });
    await request(`/posts/${f.targets[2].post.id}/remove`, f.admin.id, { reason: 'Platform review' }, 201);
  });

  it('revokes authority after membership removal, account suspension and admin demotion', async () => {
    const f = await fixture();
    await prisma.spaceMember.delete({ where: { spaceId_userId: { spaceId: f.own.id, userId: f.moderator.id } } });
    await request('/reports', f.moderator.id, undefined, 403);
    await request(`/posts/${f.targets[0].post.id}/remove`, f.moderator.id, { reason: 'Revoked' }, 403);
    await prisma.user.update({ where: { id: f.admin.id }, data: { status: 'SUSPENDED' } });
    await request('/reports', f.admin.id, undefined, 401);
    await prisma.user.update({ where: { id: f.admin.id }, data: { status: 'ACTIVE', role: 'JOB_SEEKER' } });
    await request(`/reports/${f.targets[2].report.id}/dismiss`, f.admin.id, {}, 403);
  });

  it('keeps archived-Space reports available to admins and removes local moderation authority', async () => {
    const f = await fixture();
    await prisma.space.update({ where: { id: f.own.id }, data: { archivedAt: new Date() } });
    await request('/reports', f.moderator.id, undefined, 403);
    await request(`/comments/${f.targets[0].comment.id}/remove`, f.moderator.id, {}, 403);
    await request(`/reports/${f.targets[0].report.id}/dismiss`, f.admin.id, {}, 201);
  });
});
