import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PostCollaboratorStatus } from '@prisma/client';
import {
  MAX_COLLABORATORS,
  planCollaborators,
  refusal,
  type Candidate,
  type ExistingCollaborator,
} from '../../../src/community/collaborators/collaborator-rules';
import {
  PostCollaboratorsService,
  collaboratorCards,
  nextStatus,
  withCollaboratorCards,
} from '../../../src/community/collaborators/post-collaborators.service';
import { PostsService } from '../../../src/community/posts/posts.service';

/**
 * Collaborators on posts, as on LinkedIn: up to five people (followed either
 * way) or company pages, invited by the post's author, who accept or decline.
 */

const AUTHOR = 'aaaaaaaa-0000-4000-8000-000000000001';
const ADA = 'aaaaaaaa-0000-4000-8000-0000000000ad';
const BEN = 'aaaaaaaa-0000-4000-8000-0000000000be';
const PAGE = 'bbbbbbbb-0000-4000-8000-000000000001';
const ACME = 'cccccccc-0000-4000-8000-000000000001';
const POST = 'dddddddd-0000-4000-8000-000000000001';
const { PENDING, ACCEPTED, DECLINED, LEFT } = PostCollaboratorStatus;

const person = (over: Partial<Extract<Candidate, { kind: 'person' }>> = {}): Candidate => ({
  kind: 'person', userId: ADA, name: 'Ada Lovelace', active: true, allowsInvites: true, related: true, ...over,
});
const company = (over: Partial<Extract<Candidate, { kind: 'company' }>> = {}): Candidate => ({
  kind: 'company', pageId: PAGE, companyId: ACME, name: 'Acme', live: true, ...over,
});
const context = (existing: ExistingCollaborator[] = [], postCompanyId: string | null = null) => ({ authorId: AUTHOR, postCompanyId, existing });

describe('Who may be invited to collaborate', () => {
  it('someone you follow or who follows you, who takes invitations', () => {
    expect(refusal(person(), context())).toBeNull();
    expect(refusal(person({ related: false }), context())).toMatch(/people you follow or who follow you/);
    expect(refusal(person({ allowsInvites: false }), context())).toMatch(/doesn't take collaboration invites/);
    expect(refusal(person({ active: false }), context())).toMatch(/can't be invited/);
    expect(refusal(person({ userId: AUTHOR }), context())).toMatch(/yourself/);
    expect(refusal(undefined, context())).toMatch(/no longer on Coral/);
  });

  it("a live company page — not one with no company, and not the post's own company", () => {
    expect(refusal(company(), context())).toBeNull();
    expect(refusal(company({ live: false }), context())).toMatch(/can't collaborate/);
    expect(refusal(company({ companyId: null }), context())).toMatch(/can't collaborate/);
    expect(refusal(company(), context([], ACME))).toMatch(/already Acme's/);
  });

  it('a post never asks again someone who declined or left it', () => {
    expect(refusal(person(), context([{ userId: ADA, companyId: null, status: DECLINED }]))).toMatch(/declined this post/);
    expect(refusal(company(), context([{ userId: null, companyId: ACME, status: LEFT }]))).toMatch(/left this post/);
  });
});

describe('Changing who collaborates on a post', () => {
  const existing: ExistingCollaborator[] = [
    { userId: ADA, companyId: null, status: ACCEPTED },
    { userId: null, companyId: ACME, status: PENDING },
    { userId: BEN, companyId: null, status: DECLINED },
  ];

  it('invites newcomers, takes off whoever was left out, and leaves the rest in place', () => {
    const newcomer = person({ userId: 'new-person', name: 'New' });
    const plan = planCollaborators([person(), newcomer, newcomer], existing);
    expect(plan.add).toEqual([newcomer]); // Ada stays accepted, not asked again; duplicates count once
    expect(plan.remove).toEqual([{ userId: null, companyId: ACME, status: PENDING }]);
    expect(plan.total).toBe(2);
  });
});

describe('Answering an invitation', () => {
  it('accept, decline, and leave move it where they should', () => {
    expect(nextStatus(PENDING, 'accept')).toBe(ACCEPTED);
    expect(nextStatus(PENDING, 'decline')).toBe(DECLINED);
    expect(nextStatus(ACCEPTED, 'leave')).toBe(LEFT);
    // Leaving one you never accepted is declining it.
    expect(nextStatus(PENDING, 'leave')).toBe(DECLINED);
    expect(() => nextStatus(DECLINED, 'accept')).toThrow(BadRequestException);
    expect(() => nextStatus(ACCEPTED, 'decline')).toThrow(/Remove yourself instead/);
  });
});

describe('The collaborators a post shows', () => {
  it('drops someone whose account is closed, and a private page keeps its name but has no link', () => {
    const cards = collaboratorCards([
      { userId: ADA, companyId: null, user: { id: ADA, displayName: 'Ada Lovelace', firstName: null, lastName: null, avatarUrl: null, status: 'ACTIVE' }, company: null },
      { userId: BEN, companyId: null, user: { id: BEN, displayName: 'Ben', firstName: null, lastName: null, avatarUrl: null, status: 'SUSPENDED' }, company: null },
      { userId: null, companyId: ACME, user: null, company: { id: ACME, name: 'Acme', deactivatedAt: null, page: { id: PAGE, companyLogo: null, visibility: 'private' } } },
    ] as never);
    expect(cards).toEqual([
      { kind: 'person', id: ADA, name: 'Ada Lovelace', avatarUrl: null },
      { kind: 'company', id: ACME, name: 'Acme', pageId: null, logoUrl: null },
    ]);
  });
});

describe('Turning collaborator ids into cards for a page of the feed', () => {
  it('asks nothing when no post on the page has collaborators — the usual case', async () => {
    const prisma = { user: { findMany: jest.fn() }, company: { findMany: jest.fn() } };
    const out = await withCollaboratorCards(prisma as never, [{ id: 'a', collaborators: [] }, { id: 'b' }]);
    expect(out.map((p) => p.collaborators)).toEqual([[], []]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.company.findMany).not.toHaveBeenCalled();
  });

  it('asks once for the people and once for the companies across the whole page', async () => {
    const prisma = {
      user: { findMany: jest.fn().mockResolvedValue([{ id: ADA, displayName: 'Ada Lovelace', firstName: null, lastName: null, avatarUrl: null, status: 'ACTIVE' }]) },
      company: { findMany: jest.fn().mockResolvedValue([{ id: ACME, name: 'Acme', deactivatedAt: null, page: { id: PAGE, companyLogo: null, visibility: 'public' } }]) },
    };
    const out = await withCollaboratorCards(prisma as never, [
      { id: 'a', collaborators: [{ userId: ADA, companyId: null }] },
      { id: 'b', collaborators: [{ userId: null, companyId: ACME }, { userId: ADA, companyId: null }] },
    ]);
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.company.findMany).toHaveBeenCalledTimes(1);
    expect(out[1].collaborators).toEqual([
      { kind: 'company', id: ACME, name: 'Acme', pageId: PAGE, logoUrl: null },
      { kind: 'person', id: ADA, name: 'Ada Lovelace', avatarUrl: null },
    ]);
  });
});

function collaboratorsService(over: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ displayName: 'Patrick Potika', firstName: null, lastName: null }),
      findMany: jest.fn().mockResolvedValue([
      { id: ADA, displayName: 'Ada Lovelace', firstName: null, lastName: null, status: 'ACTIVE', allowCollaborations: true },
      { id: BEN, displayName: 'Ben', firstName: null, lastName: null, status: 'ACTIVE', allowCollaborations: false },
    ]) },
    userFollow: { findMany: jest.fn().mockResolvedValue([{ followerId: AUTHOR, followingId: ADA }, { followerId: BEN, followingId: AUTHOR }]) },
    employerProfile: { findMany: jest.fn().mockResolvedValue([{ id: PAGE, companyId: ACME, companyName: 'Acme', company: { name: 'Acme' } }]) },
    post: { findUnique: jest.fn().mockResolvedValue({ id: POST, authorId: AUTHOR, companyId: null, content: 'Launch day', removedAt: null }) },
    postCollaborator: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    companyMember: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    company: { findUnique: jest.fn().mockResolvedValue({ name: 'Acme' }) },
    $transaction: jest.fn().mockResolvedValue([]),
    ...over,
  };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  return { svc: new PostCollaboratorsService(prisma as never, notifications as never), prisma, notifications };
}

describe('Checking invitees before a post is written', () => {
  it('refuses the whole post over the first one who cannot be asked — or, publishing a scheduled post, leaves them out', async () => {
    const { svc } = collaboratorsService();
    const refs = [{ kind: 'person' as const, id: ADA }, { kind: 'person' as const, id: BEN }, { kind: 'company' as const, id: PAGE }];
    await expect(svc.check(AUTHOR, null, refs)).rejects.toThrow(/Ben doesn't take collaboration invites/);
    const kept = await svc.check(AUTHOR, null, refs, { lenient: true });
    expect(kept.map((c) => c.name)).toEqual(['Ada Lovelace', 'Acme']);
  });

  it(`no more than ${MAX_COLLABORATORS}`, async () => {
    const { svc } = collaboratorsService();
    const six = Array.from({ length: 6 }, () => ({ kind: 'person' as const, id: ADA }));
    await expect(svc.check(AUTHOR, null, six)).rejects.toThrow(/up to 5/);
  });
});

describe('Answering for yourself or for a page you run', () => {
  it('accepting tells the writer; a decline is not announced', async () => {
    const { svc, prisma, notifications } = collaboratorsService();
    prisma.postCollaborator.findUnique.mockResolvedValue({ id: 'row', status: PENDING });
    await svc.respond(POST, ADA, 'accept');
    expect(prisma.postCollaborator.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { postId_userId: { postId: POST, userId: ADA } } }));
    expect(prisma.postCollaborator.update).toHaveBeenCalledWith({ where: { id: 'row' }, data: expect.objectContaining({ status: ACCEPTED, respondedById: ADA }) });
    await new Promise((r) => setImmediate(r));
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: AUTHOR, type: 'collaboration' }));

    notifications.create.mockClear();
    prisma.postCollaborator.findUnique.mockResolvedValue({ id: 'row', status: PENDING });
    await svc.respond(POST, ADA, 'decline');
    await new Promise((r) => setImmediate(r));
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('only an owner or admin answers for a company page', async () => {
    const { svc, prisma } = collaboratorsService();
    prisma.companyMember.findUnique.mockResolvedValue({ role: 'RECRUITER', status: 'ACTIVE', user: { status: 'ACTIVE' } });
    await expect(svc.respond(POST, ADA, 'accept', ACME)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.postCollaborator.update).not.toHaveBeenCalled();

    prisma.companyMember.findUnique.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE', user: { status: 'ACTIVE' } });
    prisma.postCollaborator.findUnique.mockResolvedValue({ id: 'company-row', status: ACCEPTED });
    await svc.respond(POST, ADA, 'leave', ACME);
    expect(prisma.postCollaborator.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { postId_companyId: { postId: POST, companyId: ACME } } }));
    expect(prisma.postCollaborator.update).toHaveBeenCalledWith({ where: { id: 'company-row' }, data: expect.objectContaining({ status: LEFT }) });
  });

  it('nothing to answer on a post that was removed, or with no invitation', async () => {
    const { svc, prisma } = collaboratorsService();
    prisma.postCollaborator.findUnique.mockResolvedValue(null);
    await expect(svc.respond(POST, ADA, 'accept')).rejects.toBeInstanceOf(NotFoundException);
    prisma.post.findUnique.mockResolvedValue({ id: POST, authorId: AUTHOR, companyId: null, removedAt: new Date() });
    await expect(svc.respond(POST, ADA, 'accept')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("Changing a post's collaborators after posting", () => {
  it('is for whoever posted it only', async () => {
    const { svc, prisma } = collaboratorsService();
    await expect(svc.setForPost(POST, ADA, [])).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('invites and tells the newcomers, and takes off whoever was left out', async () => {
    const { svc, prisma, notifications } = collaboratorsService();
    prisma.postCollaborator.findMany.mockResolvedValueOnce([{ userId: BEN, companyId: null, status: ACCEPTED }]);
    await svc.setForPost(POST, AUTHOR, [{ kind: 'person', id: ADA }]);
    expect(prisma.postCollaborator.deleteMany).toHaveBeenCalledWith({ where: expect.objectContaining({ postId: POST, userId: BEN }) });
    expect(prisma.postCollaborator.createMany).toHaveBeenCalledWith({ data: [{ postId: POST, userId: ADA }], skipDuplicates: true });
    await new Promise((r) => setImmediate(r));
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: ADA, title: expect.stringMatching(/invited you to collaborate/) }));
  });
});

describe('A company collaborator whose page has since gone private', () => {
  it('is kept when the author saves other changes — neither refused nor dropped', async () => {
    const { svc, prisma } = collaboratorsService();
    prisma.employerProfile.findMany.mockResolvedValue([]); // the page no longer looks up
    prisma.postCollaborator.findMany.mockResolvedValueOnce([{ userId: null, companyId: ACME, status: ACCEPTED }]);
    // Sent by the company's own id, as the manage dialog does when there is no page.
    await svc.setForPost(POST, AUTHOR, [{ kind: 'company', id: ACME }, { kind: 'person', id: ADA }]);
    expect(prisma.postCollaborator.deleteMany).not.toHaveBeenCalled();
    expect(prisma.postCollaborator.createMany).toHaveBeenCalledWith({ data: [{ postId: POST, userId: ADA }], skipDuplicates: true });
  });
});

describe('Where collaborations show', () => {
  const feed = () => {
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      post: { count },
      userFollow: { findMany: jest.fn().mockResolvedValue([{ followingId: ADA }]) },
      companyFollow: { findMany: jest.fn().mockResolvedValue([{ company: { companyId: ACME } }]) },
    };
    const svc = Object.assign(Object.create(PostsService.prototype), { prisma }) as PostsService;
    return { svc, where: () => count.mock.calls[0][0].where };
  };
  const AFTER = '2026-11-09T10:00:00.000Z';

  it("on a person's page and a company's page, beside their own posts", async () => {
    const person = feed();
    await person.svc.countNewer({ authorId: ADA }, AFTER);
    expect(person.where().AND).toEqual([{ OR: [
      { authorId: ADA, companyId: null },
      { collaborators: { some: { userId: ADA, status: ACCEPTED } } },
    ] }]);
    const page = feed();
    await page.svc.countNewer({ companyId: ACME }, AFTER);
    expect(page.where().AND).toEqual([{ OR: [
      { companyId: ACME },
      { collaborators: { some: { companyId: ACME, status: ACCEPTED } } },
    ] }]);
  });

  it('and in Following, for whoever follows a collaborator', async () => {
    const following = feed();
    await following.svc.countNewer({ filter: 'following' }, AFTER, 'me');
    expect(following.where().OR).toContainEqual({
      collaborators: { some: { status: ACCEPTED, OR: [{ userId: { in: [ADA] } }, { companyId: { in: [ACME] } }] } },
    });
  });
});

describe('A post whose invitations are refused', () => {
  it('is never written', async () => {
    const create = jest.fn();
    const svc = Object.assign(Object.create(PostsService.prototype), {
      prisma: { post: { create } },
      media: { assertPostMedia: jest.fn().mockResolvedValue(undefined) },
      collaborators: { check: jest.fn().mockRejectedValue(new BadRequestException("Ben doesn't take collaboration invites.")) },
    }) as PostsService;
    await expect(svc.create(AUTHOR, { content: 'Launch day', collaborators: [{ kind: 'person', id: BEN }] })).rejects.toThrow(/Ben/);
    expect(create).not.toHaveBeenCalled();
  });
});
