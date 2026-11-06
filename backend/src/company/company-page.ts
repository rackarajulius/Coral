import { CompanyMemberStatus, Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { looksLikeId, normalizeSlug } from './page-slug';

/**
 * A company's one page, and the page each person is shown under.
 *
 * LinkedIn's model: an organisation has one page, and whoever on the team is
 * acting — the creator, an admin who joined later, a recruiter posting a job —
 * edits that page, is shown under it, and is held to its verification.
 * EmployerProfile is one row per person, so before `Company.pageId` every
 * member carried a copy: an admin's edits went to a row nobody saw, a
 * recruiter's jobs showed their own copy, and a recruiter at a verified
 * company was asked to verify it all over again.
 *
 * A person is shown under the page of their company — their oldest membership
 * that isn't a pending request, the rule CompanyContextService uses, so a
 * removed member's old jobs stay the company's — and with no company, under
 * their own profile (the sole operator).
 *
 * Plain functions over the Prisma client, like mentions.ts, so services that
 * already hold `prisma` need nothing new injected.
 */

/** Members whose records are the company's: the fan-out rule. */
const RECORD_STATUSES = [
  CompanyMemberStatus.ACTIVE,
  CompanyMemberStatus.SUSPENDED,
  CompanyMemberStatus.REMOVED,
];

/**
 * Spread into a `user` select: brings back the page of that person's company
 * beside their own `employerProfile`. Read the two with {@link shownProfile}.
 */
export function seatPage<S extends Prisma.EmployerProfileSelect>(select: S) {
  return {
    companyMemberships: {
      where: { status: { not: CompanyMemberStatus.PENDING } },
      orderBy: { createdAt: 'asc' as const },
      take: 1,
      select: { company: { select: { page: { select } } } },
    },
  };
}

interface SeatPageShape<P> {
  employerProfile?: P | null;
  companyMemberships?: Array<{ company: { page: P | null } | null }>;
}

/** The profile a person is shown under: their company's page, else their own. */
export function shownProfile<P>(user: SeatPageShape<P> | null | undefined): P | null {
  return user?.companyMemberships?.[0]?.company?.page ?? user?.employerProfile ?? null;
}

/**
 * A record with `postedBy` as the API returns it: `postedBy.employerProfile`
 * is the company's page, and the membership used to find it is left out, so
 * every client keeps reading the field it always read.
 */
export function withShownEmployer<T>(record: T): T {
  const postedBy = (record as { postedBy?: (SeatPageShape<unknown> & Record<string, unknown>) | null } | null)
    ?.postedBy;
  if (!postedBy || !('companyMemberships' in postedBy)) return record;
  const { companyMemberships: _seat, ...rest } = postedBy;
  return {
    ...(record as object),
    postedBy: { ...rest, employerProfile: shownProfile(postedBy) },
  } as T;
}

type Shown<S extends Prisma.EmployerProfileSelect> = Prisma.EmployerProfileGetPayload<{ select: S }>;

/** The profile one person is shown under, with the fields asked for. */
export async function profileShownFor<S extends Prisma.EmployerProfileSelect>(
  db: Pick<PrismaService, 'user'>,
  userId: string,
  select: S,
): Promise<Shown<S> | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { employerProfile: { select }, ...seatPage(select) },
  });
  return shownProfile(user as unknown as SeatPageShape<Shown<S>> | null);
}

/** The same for many people, keyed by user id. People with neither are left out. */
export async function profilesShownFor<S extends Prisma.EmployerProfileSelect>(
  db: Pick<PrismaService, 'user'>,
  userIds: string[],
  select: S,
): Promise<Map<string, Shown<S>>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const shown = new Map<string, Shown<S>>();
  if (ids.length === 0) return shown;
  const users = (await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, employerProfile: { select }, ...seatPage(select) },
  })) as unknown as Array<{ id: string } & SeatPageShape<Shown<S>>>;
  for (const user of users) {
    const profile = shownProfile(user);
    if (profile) shown.set(user.id, profile);
  }
  return shown;
}

/**
 * A company's page id. A company without one — its page was deleted, or it
 * predates pages — adopts the profile the migration would have chosen: the
 * oldest linked profile that isn't private, else the oldest at all.
 */
export async function companyPageId(
  db: Pick<PrismaService, 'company' | 'employerProfile'>,
  companyId: string,
): Promise<string | null> {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { pageId: true } });
  if (!company) return null;
  if (company.pageId) return company.pageId;

  const linked = await db.employerProfile.findMany({
    where: { companyId },
    select: { id: true, visibility: true },
    orderBy: { createdAt: 'asc' },
  });
  const chosen = linked.find((p) => p.visibility !== 'private') ?? linked[0];
  if (!chosen) return null;
  // Only while still empty, so two requests adopting at once settle on one.
  await db.company
    .updateMany({ where: { id: companyId, pageId: null }, data: { pageId: chosen.id } })
    .catch(() => undefined);
  const settled = await db.company.findUnique({ where: { id: companyId }, select: { pageId: true } });
  return settled?.pageId ?? chosen.id;
}

/**
 * The page a profile id stands for. A member's own row — where a teammate's
 * job used to link — resolves to their company's page, so an old link lands
 * on the company rather than on a copy of it.
 */
export async function canonicalPageId(
  db: Pick<PrismaService, 'company' | 'employerProfile'>,
  profileId: string,
): Promise<string | null> {
  const profile = await db.employerProfile.findUnique({
    where: { id: profileId },
    select: { id: true, companyId: true, pageOf: { select: { id: true } } },
  });
  if (!profile) return null;
  // A page stands for itself, whatever its row's company link says.
  if (profile.pageOf || !profile.companyId) return profile.id;
  return (await companyPageId(db, profile.companyId)) ?? profile.id;
}

/**
 * The page a public reference points at: a profile id (any member's, which
 * stands for their company's page) or the page's own address, /company/<slug>.
 */
export async function resolvePageRef(
  db: Pick<PrismaService, 'company' | 'employerProfile'>,
  ref: string,
): Promise<string | null> {
  if (looksLikeId(ref)) return canonicalPageId(db, ref);
  const slug = normalizeSlug(ref);
  if (!slug) return null;
  const page = await db.employerProfile.findUnique({ where: { slug }, select: { id: true } });
  return page ? canonicalPageId(db, page.id) : null;
}

/**
 * Whose jobs a page shows: everyone whose records are the company's (active,
 * suspended and removed members — the fan-out rule) plus the page's own
 * person, or that person alone when the page is a sole operator's profile.
 */
export async function pagePosterIds(
  db: Pick<PrismaService, 'company' | 'companyMember'>,
  page: { id: string; userId: string },
): Promise<string[]> {
  return (await postersByPage(db, [page])).get(page.id) ?? [page.userId];
}

/**
 * {@link pagePosterIds} for many pages at once, keyed by page id. The company
 * is the one whose page it is (Company.pageId), not the row's own company
 * link, which follows the person rather than the page.
 */
export async function postersByPage(
  db: Pick<PrismaService, 'company' | 'companyMember'>,
  pages: Array<{ id: string; userId: string }>,
): Promise<Map<string, string[]>> {
  const pageIds = pages.map((p) => p.id);
  const companies = pageIds.length
    ? await db.company.findMany({ where: { pageId: { in: pageIds } }, select: { id: true, pageId: true } })
    : [];
  const companyByPage = new Map(companies.map((c) => [c.pageId as string, c.id]));
  const members = companies.length
    ? await db.companyMember.findMany({
        where: { companyId: { in: companies.map((c) => c.id) }, status: { in: RECORD_STATUSES } },
        select: { companyId: true, userId: true },
      })
    : [];
  const byPage = new Map<string, string[]>();
  for (const page of pages) {
    const ids = new Set([page.userId]);
    const companyId = companyByPage.get(page.id);
    if (companyId) {
      for (const m of members) if (m.companyId === companyId) ids.add(m.userId);
    }
    byPage.set(page.id, [...ids]);
  }
  return byPage;
}

/**
 * Profiles that are a page: a company's page, or a sole operator's own
 * profile. A member's copy is never listed, mentioned or linked as a company.
 */
export const IS_PAGE: Prisma.EmployerProfileWhereInput = {
  OR: [{ pageOf: { isNot: null } }, { companyId: null }],
};

/**
 * {@link IS_PAGE}, leaving out pages whose company has deactivated them
 * (company-status.service.ts): they are out of search, the directory and
 * @mentions until an owner brings them back.
 */
export const IS_LIVE_PAGE: Prisma.EmployerProfileWhereInput = {
  AND: [IS_PAGE, { NOT: { pageOf: { is: { deactivatedAt: { not: null } } } } }],
};
