import { CompanyMemberStatus, CompanyRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { personName } from '../common/person-name';

type Db = Pick<PrismaService, 'companyMember' | 'company' | 'employerProfile' | 'job'>;

export interface DepartureOutcome {
  companyId: string;
  companyName: string;
  /**
   * handed_over: the page, ownership and their jobs went to a teammate.
   * deactivated: they were the only one left, so the company was taken down.
   */
  outcome: 'handed_over' | 'deactivated';
  successorName?: string;
}

/**
 * Before an account is deleted, keep its companies whole.
 *
 * A company page is a person's EmployerProfile row (Company.pageId), so
 * deleting the account behind it used to delete the page — its followers, its
 * address, its details — and the company came back as a teammate's empty copy,
 * unlisted, with none of it. And the person's jobs went too, taking every
 * candidate's application with them.
 *
 * Now, for each company they're in:
 * - with someone else still active, the best-placed teammate (an owner, else
 *   an admin, else the longest-serving) takes over: ownership if the person
 *   owned it, the page row itself (so followers and the address stay), and —
 *   for the company their jobs are shown under — those jobs and their
 *   applications;
 * - with nobody else, the company is deactivated. The page row still goes
 *   with the account — it is that person's row — but what remains is a
 *   company marked as taken down, never a half page that adopts a stray copy.
 *
 * Runs inside the caller's transaction, before the account is deleted.
 */
export async function handOverCompanies(db: Db, userId: string): Promise<DepartureOutcome[]> {
  const memberships = await db.companyMember.findMany({
    where: { userId, status: { in: [CompanyMemberStatus.ACTIVE, CompanyMemberStatus.SUSPENDED] } },
    orderBy: { createdAt: 'asc' },
    select: {
      companyId: true,
      role: true,
      company: { select: { name: true, pageId: true, deactivatedAt: true } },
    },
  });
  if (memberships.length === 0) return [];

  const own = await db.employerProfile.findUnique({ where: { userId }, select: { id: true } });
  const rank = (role: CompanyRole) => (role === CompanyRole.OWNER ? 0 : role === CompanyRole.ADMIN ? 1 : 2);
  const outcomes: DepartureOutcome[] = [];

  for (const [index, m] of memberships.entries()) {
    const others = await db.companyMember.findMany({
      where: { companyId: m.companyId, status: CompanyMemberStatus.ACTIVE, userId: { not: userId } },
      orderBy: { createdAt: 'asc' },
      select: {
        userId: true,
        role: true,
        user: {
          select: {
            firstName: true, lastName: true, displayName: true,
            employerProfile: { select: { id: true, jobTitle: true, pageOf: { select: { id: true } } } },
          },
        },
      },
    });
    // Someone whose own row is another company's page can't take this one:
    // a person has one row, and it can be only one company's page.
    const successor = others
      .filter((o) => !o.user.employerProfile?.pageOf)
      .sort((a, b) => rank(a.role) - rank(b.role))[0];

    if (!successor) {
      if (!m.company.deactivatedAt) {
        await db.company.update({
          where: { id: m.companyId },
          data: { deactivatedAt: new Date(), deactivatedById: null },
        });
      }
      outcomes.push({ companyId: m.companyId, companyName: m.company.name, outcome: 'deactivated' });
      continue;
    }

    if (m.role === CompanyRole.OWNER && successor.role !== CompanyRole.OWNER) {
      await db.companyMember.update({
        where: { companyId_userId: { companyId: m.companyId, userId: successor.userId } },
        data: { role: CompanyRole.OWNER },
      });
    }

    if (own && m.company.pageId === own.id) {
      // The page row changes hands; the successor's own copy, if any, goes,
      // keeping their job title. Personal flags are the old owner's, so reset.
      const theirs = successor.user.employerProfile;
      if (theirs) await db.employerProfile.delete({ where: { id: theirs.id } });
      await db.employerProfile.update({
        where: { id: own.id },
        data: {
          userId: successor.userId,
          jobTitle: theirs?.jobTitle ?? '',
          isRecruiter: false,
          isHiringManager: false,
          isAdmin: false,
        },
      });
    }

    // Their jobs are shown under their oldest company; that company keeps them.
    if (index === 0) {
      await db.job.updateMany({ where: { postedById: userId }, data: { postedById: successor.userId } });
    }

    outcomes.push({
      companyId: m.companyId,
      companyName: m.company.name,
      outcome: 'handed_over',
      successorName: personName(successor.user, 'a teammate'),
    });
  }
  return outcomes;
}

/** One line for an audit entry or a confirmation. */
export function describeDeparture(outcomes: DepartureOutcome[]): string | null {
  if (outcomes.length === 0) return null;
  return outcomes
    .map((o) => (o.outcome === 'handed_over'
      ? `${o.companyName} passed to ${o.successorName}`
      : `${o.companyName} deactivated (no one else on the team)`))
    .join('; ');
}
