import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CompanyMemberStatus, CompanyRole, PostCollaboratorStatus, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { personName } from '../../common/person-name';
import { publicImageUrl } from '../../common/public-image-url';
import { IS_LIVE_PAGE } from '../../company/company-page';
import { HIDDEN_STATUSES } from '../people-follow.service';
import { excerpt, plainText, writerName } from '../mentions';
import { runsCompanyPage } from '../page-admins';
import {
  COLLABORATION_NOTIFICATION,
  MAX_COLLABORATORS,
  planCollaborators,
  refKey,
  refusal,
  type Candidate,
  type CollaboratorRef,
  type ExistingCollaborator,
} from './collaborator-rules';

/**
 * What a post carries about its collaborators: who accepted, by id, in the
 * order they joined. Pending and declined invitations are nobody's business
 * but the post's managers' and the invitee's.
 *
 * Ids only, read beside the rest of the post. Names and pictures are looked
 * up afterwards for just the posts that have any (`withCollaboratorCards`),
 * because nearly none do, and a nested include asks after people, companies
 * and pages for every page of the feed regardless.
 */
export const ACCEPTED_COLLABORATORS = {
  where: { status: PostCollaboratorStatus.ACCEPTED },
  orderBy: { respondedAt: 'asc' as const },
  select: { userId: true, companyId: true },
} satisfies Prisma.PostCollaboratorFindManyArgs;

/** A collaborator with what a card needs about them. */
const COLLABORATOR_DETAILS = {
  userId: true,
  companyId: true,
  user: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true, status: true } },
  company: {
    select: { id: true, name: true, deactivatedAt: true, page: { select: { id: true, companyLogo: true, visibility: true } } },
  },
} satisfies Prisma.PostCollaboratorSelect;

type CollaboratorRow = Prisma.PostCollaboratorGetPayload<{ select: typeof COLLABORATOR_DETAILS }>;

/**
 * Turns the collaborator ids each post carries into cards — two lookups for
 * the whole page, and none at all when no post on it has collaborators.
 */
export async function withCollaboratorCards<T extends { collaborators?: Array<{ userId: string | null; companyId: string | null }> }>(
  prisma: Pick<PrismaService, 'user' | 'company'>,
  posts: T[],
): Promise<Array<Omit<T, 'collaborators'> & { collaborators: CollaboratorCard[] }>> {
  const userIds = [...new Set(posts.flatMap((p) => (p.collaborators ?? []).flatMap((c) => (c.userId ? [c.userId] : []))))];
  const companyIds = [...new Set(posts.flatMap((p) => (p.collaborators ?? []).flatMap((c) => (c.companyId ? [c.companyId] : []))))];
  const [users, companies] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: COLLABORATOR_DETAILS.user.select }) : Promise.resolve([]),
    companyIds.length ? prisma.company.findMany({ where: { id: { in: companyIds } }, select: COLLABORATOR_DETAILS.company.select }) : Promise.resolve([]),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const companyById = new Map(companies.map((c) => [c.id, c]));
  return posts.map((post) => ({
    ...post,
    collaborators: collaboratorCards(
      (post.collaborators ?? []).map((c) => ({
        userId: c.userId,
        companyId: c.companyId,
        user: c.userId ? userById.get(c.userId) ?? null : null,
        company: c.companyId ? companyById.get(c.companyId) ?? null : null,
      })),
    ),
  }));
}

/** A collaborator as a post shows them: a person (by user id) or a company (by Company id, with its page to link to). */
export type CollaboratorCard =
  | { kind: 'person'; id: string; name: string; avatarUrl: string | null }
  | { kind: 'company'; id: string; name: string; pageId: string | null; logoUrl: string | null };

/**
 * The cards a post shows. Someone whose account was closed or suspended drops
 * off, as they do everywhere else; a company whose page is private or taken
 * down keeps its name but has nowhere to link.
 */
export function collaboratorCards(rows: CollaboratorRow[] | undefined | null): CollaboratorCard[] {
  return (rows ?? []).flatMap((row): CollaboratorCard[] => {
    if (row.user) {
      if (HIDDEN_STATUSES.includes(row.user.status)) return [];
      return [{ kind: 'person', id: row.user.id, name: personName(row.user, 'Someone'), avatarUrl: row.user.avatarUrl ?? null }];
    }
    if (row.company) {
      const page = row.company.page && row.company.page.visibility !== 'private' && !row.company.deactivatedAt ? row.company.page : null;
      return [{ kind: 'company', id: row.company.id, name: row.company.name, pageId: page?.id ?? null, logoUrl: publicImageUrl(page?.companyLogo) }];
    }
    return [];
  });
}

/** What the viewer has to do with a post: an invitation to answer, or a collaboration to leave. */
export type ViewerCollaboration =
  | { as: 'person'; status: 'PENDING' | 'ACCEPTED' }
  | { as: 'company'; companyId: string; name: string; status: 'PENDING' | 'ACCEPTED' };

export type CollaborationAction = 'accept' | 'decline' | 'leave';

const ACTIVE_STATUSES: PostCollaboratorStatus[] = [PostCollaboratorStatus.PENDING, PostCollaboratorStatus.ACCEPTED];
/** How many of each the picker offers. */
const SUGGESTIONS = 8;

/**
 * Collaborators on community posts, as on LinkedIn: up to five people or
 * company pages invited onto a post by its author, who accept or decline.
 * Accepted, the post shows them on its byline and appears on their profile or
 * page and to their followers. The rules for who may be invited are in
 * collaborator-rules.ts.
 */
@Injectable()
export class PostCollaboratorsService {
  private readonly logger = new Logger(PostCollaboratorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * The people and pages asked for, looked up as the rules need them: a
   * person with their standing and whether they and the author follow either
   * way; a company page if it is live, with the company it belongs to.
   */
  async candidatesFor(authorId: string, refs: CollaboratorRef[]): Promise<Map<string, Candidate>> {
    const personIds = [...new Set(refs.filter((r) => r.kind === 'person').map((r) => r.id.toLowerCase()))];
    const pageIds = [...new Set(refs.filter((r) => r.kind === 'company').map((r) => r.id.toLowerCase()))];
    const [people, follows, pages] = await Promise.all([
      personIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: personIds } },
            select: { id: true, displayName: true, firstName: true, lastName: true, status: true, allowCollaborations: true },
          })
        : Promise.resolve([]),
      personIds.length
        ? this.prisma.userFollow.findMany({
            where: {
              OR: [
                { followerId: authorId, followingId: { in: personIds } },
                { followingId: authorId, followerId: { in: personIds } },
              ],
            },
            select: { followerId: true, followingId: true },
          })
        : Promise.resolve([]),
      pageIds.length
        ? this.prisma.employerProfile.findMany({
            where: { id: { in: pageIds }, AND: [IS_LIVE_PAGE, { visibility: { not: 'private' } }] },
            select: { id: true, companyId: true, companyName: true, company: { select: { name: true } } },
          })
        : Promise.resolve([]),
    ]);

    const related = new Set(follows.map((f) => (f.followerId === authorId ? f.followingId : f.followerId)));
    const found = new Map<string, Candidate>();
    for (const p of people) {
      found.set(refKey({ kind: 'person', id: p.id }), {
        kind: 'person',
        userId: p.id,
        name: personName(p, 'Someone'),
        active: p.status === UserStatus.ACTIVE,
        allowsInvites: p.allowCollaborations,
        related: related.has(p.id),
      });
    }
    for (const page of pages) {
      found.set(refKey({ kind: 'company', id: page.id }), {
        kind: 'company',
        pageId: page.id,
        companyId: page.companyId,
        name: page.company?.name?.trim() || page.companyName,
        live: true,
      });
    }
    return found;
  }

  /**
   * The invitees for a post not yet written. Strict — the composer, and
   * scheduling — refuses the whole post over the first one that can't be
   * asked, so nobody finds out later that someone wasn't. Lenient — a
   * scheduled post publishing hours later, when someone may since have turned
   * invitations off — leaves them out instead of failing the post.
   */
  async check(
    authorId: string,
    postCompanyId: string | null,
    refs: CollaboratorRef[] | undefined,
    { lenient = false }: { lenient?: boolean } = {},
  ): Promise<Candidate[]> {
    if (!refs?.length) return [];
    if (!lenient && refs.length > MAX_COLLABORATORS) {
      throw new BadRequestException(`You can invite up to ${MAX_COLLABORATORS} collaborators.`);
    }
    const candidates = await this.candidatesFor(authorId, refs);
    const ok: Candidate[] = [];
    for (const ref of refs) {
      const candidate = candidates.get(refKey(ref));
      const problem = refusal(candidate, { authorId, postCompanyId, existing: [] });
      if (problem) {
        if (lenient) continue;
        throw new BadRequestException(problem);
      }
      ok.push(candidate!);
    }
    return planCollaborators(ok, []).add.slice(0, MAX_COLLABORATORS);
  }

  /** Invites them onto a post just written, and tells them. */
  async inviteForNewPost(
    post: { id: string; authorId: string; companyId: string | null; content: string },
    invitees: Candidate[],
  ): Promise<void> {
    if (invitees.length === 0) return;
    await this.prisma.postCollaborator.createMany({ data: invitees.map((c) => rowFor(post.id, c)), skipDuplicates: true });
    void this.tellInvited(post, invitees);
  }

  /** Everyone on a post and everyone still asked, for the people who manage it. */
  async listForManager(postId: string, userId: string) {
    await this.postToManage(postId, userId);
    return this.managedList(postId);
  }

  /**
   * Sets who collaborates on a post, as its manager wants it now: newcomers
   * invited (and checked as if new), anyone left out taken off. Someone kept
   * keeps their place, even if they could not be invited today.
   */
  async setForPost(postId: string, userId: string, refs: CollaboratorRef[]) {
    const post = await this.postToManage(postId, userId);
    if (refs.length > MAX_COLLABORATORS) throw new BadRequestException(`You can invite up to ${MAX_COLLABORATORS} collaborators.`);
    const [candidates, existing] = await Promise.all([
      this.candidatesFor(post.authorId, refs),
      this.prisma.postCollaborator.findMany({ where: { postId }, select: { userId: true, companyId: true, status: true } }),
    ]);

    const wanted: Candidate[] = [];
    const kept: ExistingCollaborator[] = [];
    for (const ref of refs) {
      const candidate = candidates.get(refKey(ref));
      if (candidate) {
        wanted.push(candidate);
        continue;
      }
      // Someone already on the post who can no longer be looked up — a
      // company whose page went private, sent by its Company id — stays
      // rather than blocking the change or being dropped from it.
      const id = ref.id.toLowerCase();
      const already = existing.find(
        (row) => ACTIVE_STATUSES.includes(row.status) && (ref.kind === 'person' ? row.userId === id : row.companyId === id),
      );
      if (!already) throw new BadRequestException(refusal(undefined, { authorId: post.authorId, postCompanyId: post.companyId, existing })!);
      kept.push(already);
    }

    const plan = planCollaborators(wanted, existing);
    const remove = plan.remove.filter((row) => !kept.includes(row));
    if (plan.total + kept.length > MAX_COLLABORATORS) throw new BadRequestException(`You can invite up to ${MAX_COLLABORATORS} collaborators.`);
    for (const candidate of plan.add) {
      const problem = refusal(candidate, { authorId: post.authorId, postCompanyId: post.companyId, existing });
      if (problem) throw new BadRequestException(problem);
    }

    await this.prisma.$transaction([
      ...remove.map((row) =>
        this.prisma.postCollaborator.deleteMany({
          where: { postId, ...(row.userId ? { userId: row.userId } : { companyId: row.companyId }), status: { in: ACTIVE_STATUSES } },
        }),
      ),
      ...(plan.add.length ? [this.prisma.postCollaborator.createMany({ data: plan.add.map((c) => rowFor(postId, c)), skipDuplicates: true })] : []),
    ]);
    void this.tellInvited(post, plan.add);
    return this.managedList(postId);
  }

  /**
   * An invitee answering, or a collaborator leaving: as themselves, or for a
   * company page they run (any of its owners or admins may answer for it).
   */
  async respond(postId: string, userId: string, action: CollaborationAction, companyId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, companyId: true, removedAt: true },
    });
    if (!post || post.removedAt) throw new NotFoundException('Post not found');
    if (companyId && !(await runsCompanyPage(this.prisma, userId, companyId))) {
      throw new ForbiddenException('Only an owner or admin of the company can answer for its page.');
    }

    const where = companyId
      ? { postId_companyId: { postId, companyId } }
      : { postId_userId: { postId, userId } };
    const row = await this.prisma.postCollaborator.findUnique({ where, select: { id: true, status: true } });
    if (!row) throw new NotFoundException("There's no invitation to collaborate on this post.");

    const next = nextStatus(row.status, action);
    if (next !== row.status) {
      await this.prisma.postCollaborator.update({
        where: { id: row.id },
        data: { status: next, respondedById: userId, respondedAt: new Date() },
      });
      if (next === PostCollaboratorStatus.ACCEPTED) void this.tellAccepted(post, userId, companyId);
    }
    return this.viewerState(postId, userId);
  }

  /** The viewer's own invitations and collaborations on a post, as themselves and for pages they run. */
  async viewerState(postId: string, viewerId: string | undefined): Promise<ViewerCollaboration[]> {
    if (!viewerId) return [];
    const rows = await this.prisma.postCollaborator.findMany({
      where: { postId, status: { in: ACTIVE_STATUSES } },
      select: { userId: true, companyId: true, status: true, company: { select: { name: true } } },
    });
    const companyIds = rows.flatMap((r) => (r.companyId ? [r.companyId] : []));
    const run = companyIds.length
      ? new Set(
          (await this.prisma.companyMember.findMany({
            where: {
              userId: viewerId,
              companyId: { in: companyIds },
              status: CompanyMemberStatus.ACTIVE,
              role: { in: [CompanyRole.OWNER, CompanyRole.ADMIN] },
            },
            select: { companyId: true },
          })).map((m) => m.companyId),
        )
      : new Set<string>();
    return rows.flatMap((row): ViewerCollaboration[] => {
      const status = row.status as 'PENDING' | 'ACCEPTED';
      if (row.userId === viewerId) return [{ as: 'person', status }];
      if (row.companyId && run.has(row.companyId)) return [{ as: 'company', companyId: row.companyId, name: row.company?.name ?? 'Your company', status }];
      return [];
    });
  }

  /**
   * Who the picker offers: people the viewer follows or who follow them and
   * take invitations, matching what was typed (with nothing typed, the most
   * recent of them); and, once something is typed, live company pages the
   * viewer may see, as the @ menu finds them.
   */
  async suggest(viewerId: string, query: string | undefined) {
    const words = (query ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 4).map((w) => w.slice(0, 50));
    const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const });
    const [people, pages] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          AND: [
            { id: { not: viewerId } },
            { status: UserStatus.ACTIVE },
            { allowCollaborations: true },
            { OR: [{ followers: { some: { followerId: viewerId } } }, { following: { some: { followingId: viewerId } } }] },
            ...words.map((w) => ({ OR: [{ firstName: contains(w) }, { lastName: contains(w) }, { displayName: contains(w) }] })),
          ],
        },
        select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
      words.length
        ? this.prisma.employerProfile.findMany({
            where: {
              AND: [
                IS_LIVE_PAGE,
                { visibility: { not: 'private' } },
                { companyId: { not: null } },
                {
                  OR: [
                    { visibility: 'public' },
                    { followers: { some: { userId: viewerId } } },
                    { company: { members: { some: { userId: viewerId, status: CompanyMemberStatus.ACTIVE } } } },
                  ],
                },
                ...words.map((w) => ({ OR: [{ companyName: contains(w) }, { company: { name: contains(w) } }] })),
              ],
            },
            select: { id: true, companyId: true, companyName: true, companyLogo: true, company: { select: { name: true } } },
            orderBy: { createdAt: 'asc' },
            take: 25,
          })
        : Promise.resolve([]),
    ]);

    const first = words[0]?.toLowerCase() ?? '';
    const rank = (name: string) => (first && name.toLowerCase().startsWith(first) ? 0 : 1);
    const named = people
      .map((p) => ({ id: p.id, name: personName(p, 'Someone'), avatarUrl: webImage(p.avatarUrl) }))
      .sort((a, b) => (first ? rank(a.name) - rank(b.name) || a.name.localeCompare(b.name) : 0))
      .slice(0, SUGGESTIONS);
    const byCompany = new Map<string, { id: string; name: string; logoUrl: string | null }>();
    for (const page of pages) {
      const key = page.companyId ?? page.id;
      if (!byCompany.has(key)) byCompany.set(key, { id: page.id, name: page.company?.name?.trim() || page.companyName, logoUrl: webImage(page.companyLogo) });
    }
    const companies = [...byCompany.values()].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name)).slice(0, SUGGESTIONS);
    return { people: named, companies };
  }

  async getSettings(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { allowCollaborations: true } });
    return { allowCollaborations: user?.allowCollaborations ?? true };
  }

  async setSettings(userId: string, allowCollaborations: boolean) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { allowCollaborations }, select: { allowCollaborations: true } });
    return { allowCollaborations: user.allowCollaborations };
  }

  /** A post its viewer may manage: the author of a personal post, or an owner or admin of the company a company post speaks for. */
  private async postToManage(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, companyId: true, content: true, removedAt: true },
    });
    if (!post || post.removedAt) throw new NotFoundException('Post not found');
    const allowed = post.companyId ? await runsCompanyPage(this.prisma, userId, post.companyId) : post.authorId === userId;
    if (!allowed) throw new ForbiddenException('Only whoever posted it can change its collaborators.');
    return post;
  }

  private async managedList(postId: string) {
    const rows = await this.prisma.postCollaborator.findMany({
      where: { postId, status: { in: ACTIVE_STATUSES } },
      orderBy: { createdAt: 'asc' },
      select: { ...COLLABORATOR_DETAILS, status: true },
    });
    return rows.flatMap((row) => collaboratorCards([row]).map((card) => ({ ...card, status: row.status as 'PENDING' | 'ACCEPTED' })));
  }

  /** Each person told themselves; each company through the people who run its page. Never the writer. */
  private async tellInvited(post: { id: string; authorId: string; companyId: string | null; content: string }, invitees: Candidate[]) {
    if (invitees.length === 0) return;
    try {
      const companyIds = invitees.flatMap((c) => (c.kind === 'company' && c.companyId ? [c.companyId] : []));
      const [who, runners] = await Promise.all([
        writerName(this.prisma, post.authorId, post.companyId),
        companyIds.length
          ? this.prisma.companyMember.findMany({
              where: {
                companyId: { in: companyIds },
                status: CompanyMemberStatus.ACTIVE,
                role: { in: [CompanyRole.OWNER, CompanyRole.ADMIN] },
                user: { status: UserStatus.ACTIVE },
              },
              select: { companyId: true, userId: true },
            })
          : Promise.resolve([] as Array<{ companyId: string; userId: string }>),
      ]);
      const told = new Set([post.authorId]);
      const message = excerpt(plainText(post.content)) || 'Open the post to accept or decline.';
      const link = `/community/posts/${post.id}`;
      const tell = async (userId: string, title: string) => {
        if (told.has(userId)) return;
        told.add(userId);
        await this.notifications.create({ userId, type: COLLABORATION_NOTIFICATION, title, message, link });
      };
      for (const c of invitees) if (c.kind === 'person') await tell(c.userId, `${who} invited you to collaborate on a post`);
      for (const c of invitees) {
        if (c.kind !== 'company') continue;
        for (const r of runners.filter((m) => m.companyId === c.companyId)) {
          await tell(r.userId, `${who} invited ${c.name} to collaborate on a post`);
        }
      }
    } catch (err) {
      this.logger.warn(`Collaboration invitations for post ${post.id} failed: ${(err as Error).message}`);
    }
  }

  /** The writer hears when someone joins. A decline is not announced. */
  private async tellAccepted(post: { id: string; authorId: string }, responderId: string, companyId?: string) {
    if (post.authorId === responderId) return;
    try {
      const name = companyId
        ? (await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }))?.name ?? 'A company'
        : await writerName(this.prisma, responderId);
      await this.notifications.create({
        userId: post.authorId,
        type: COLLABORATION_NOTIFICATION,
        title: `${name} accepted your invitation to collaborate`,
        message: 'Your post now shows on their page too.',
        link: `/community/posts/${post.id}`,
      });
    } catch (err) {
      this.logger.warn(`Acceptance notice for post ${post.id} failed: ${(err as Error).message}`);
    }
  }
}

/** Where an answer leaves an invitation. A collaborator leaving a pending one has declined it. */
export function nextStatus(current: PostCollaboratorStatus, action: CollaborationAction): PostCollaboratorStatus {
  const { PENDING, ACCEPTED, DECLINED, LEFT } = PostCollaboratorStatus;
  if (action === 'accept') {
    if (current === PENDING || current === ACCEPTED) return ACCEPTED;
    throw new BadRequestException(current === DECLINED ? 'You declined this invitation.' : 'You left this post.');
  }
  if (action === 'decline') {
    if (current === PENDING || current === DECLINED) return DECLINED;
    throw new BadRequestException(current === ACCEPTED ? 'You already collaborate on this post. Remove yourself instead.' : 'You left this post.');
  }
  if (current === ACCEPTED || current === LEFT) return LEFT;
  if (current === PENDING || current === DECLINED) return DECLINED;
  return current;
}

function rowFor(postId: string, c: Candidate): Prisma.PostCollaboratorCreateManyInput {
  return c.kind === 'person' ? { postId, userId: c.userId } : { postId, companyId: c.companyId! };
}

/** A picture fit to send in a list: a web address, never an inline data URI. */
function webImage(value: string | null | undefined): string | null {
  const url = value?.trim();
  return url && /^https?:\/\//i.test(url) ? url : null;
}

export type { ExistingCollaborator };
