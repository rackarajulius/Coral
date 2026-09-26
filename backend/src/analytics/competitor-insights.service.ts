import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { LIVE_JOB_STATUSES } from '../jobs/job-lifecycle.service';
import { RoleSimilarity, roleSimilarity, skillSet, titleTokens } from '../common/job-text';
import { User } from '../common/types/user.types';

/** Your own live roles compared. More than this and the page is a report, not a glance. */
const MAX_OWN_ROLES = 20;
/** Other companies' live jobs scanned. Same ceiling the talent table uses. */
const SCAN_LIMIT = 5000;
const TOP_COMPANIES = 10;
const EXAMPLES_PER_COMPANY = 3;
/** Below this many comparable posts a median is an anecdote, so none is given. */
const MIN_PAY_SAMPLES = 3;

type Similarity = RoleSimilarity;

interface JobRow {
  id: string;
  title: string;
  skills: string[];
  location: string | null;
  isRemote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string | null;
  publishedAt: Date | null;
  createdAt: Date;
}

interface OtherJobRow extends JobRow {
  postedById: string;
  companyName: string | null;
  companyLogo: string | null;
  postedBy: {
    employerProfile: {
      id: string;
      companyId: string | null;
      companyName: string;
      companyLogo: string | null;
    } | null;
  } | null;
}

/**
 * Who else on Coral is hiring for roles like yours.
 *
 * Every number is a count of live job posts on this platform, matched by rules
 * that can be read in this file — no model, no market index. The response says
 * so, because a company that posts elsewhere is invisible here, and that is
 * most of any real market.
 *
 * Two jobs are "similar" when their titles mean the same role once seniority
 * and contract words are stripped, or when they ask for enough of the same
 * skills that they are fishing in the same pool. The reason is returned with
 * each match so the claim is checkable.
 */
@Injectable()
export class CompetitorInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
  ) {}

  async forEmployer(user: User) {
    const context = await this.companyContext.forUser(user.id);
    const memberIds = context?.memberUserIds ?? [user.id];

    const jobSelect = {
      id: true, title: true, skills: true, location: true, isRemote: true,
      salaryMin: true, salaryMax: true, salaryCurrency: true, salaryPeriod: true,
      publishedAt: true, createdAt: true,
    } as const;

    const [mine, ownProfile] = await Promise.all([
      this.prisma.job.findMany({
        where: { postedById: { in: memberIds }, status: { in: LIVE_JOB_STATUSES } },
        select: jobSelect,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: MAX_OWN_ROLES,
      }),
      this.prisma.employerProfile.findUnique({
        where: { userId: user.id },
        select: { companyName: true },
      }),
    ]);

    const note =
      'Live job posts on Coral only. Companies hiring elsewhere are not counted, so this is a floor, not the market.';

    if (mine.length === 0) {
      return { summary: { companies: 0, jobs: 0, rolesCompared: 0 }, companies: [], roles: [], note };
    }

    const others: OtherJobRow[] = await this.prisma.job.findMany({
      where: {
        status: { in: LIVE_JOB_STATUSES },
        postedById: { notIn: memberIds },
        // A teammate whose membership is pending still posts as the company.
        ...(context
          ? { NOT: { postedBy: { employerProfile: { companyId: context.companyId } } } }
          : {}),
      },
      select: {
        ...jobSelect,
        postedById: true,
        companyName: true,
        companyLogo: true,
        postedBy: {
          select: {
            employerProfile: {
              select: { id: true, companyId: true, companyName: true, companyLogo: true },
            },
          },
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: SCAN_LIMIT,
    });

    const ownName = (context?.companyName ?? ownProfile?.companyName ?? '').trim().toLowerCase();
    const mineParsed = mine.map((j) => ({ job: j, title: titleTokens(j.title), skills: skillSet(j.skills) }));

    type CompanyAgg = {
      key: string;
      name: string;
      logo: string | null;
      profileId: string | null;
      jobs: Map<string, { job: OtherJobRow; reason: Similarity; matchedRole: string }>;
      matchedRoles: Set<string>;
      latest: Date;
    };
    const companies = new Map<string, CompanyAgg>();
    const perRole = new Map<string, { companies: Set<string>; jobs: OtherJobRow[] }>(
      mine.map((j) => [j.id, { companies: new Set(), jobs: [] }]),
    );

    for (const other of others) {
      const identity = this.companyOf(other);
      // Same company under a posting the membership table doesn't know about.
      if (ownName && identity.name.trim().toLowerCase() === ownName) continue;

      const otherTitle = titleTokens(other.title);
      const otherSkills = skillSet(other.skills);

      for (const m of mineParsed) {
        const reason = roleSimilarity(m.title, m.skills, otherTitle, otherSkills);
        if (!reason) continue;

        const role = perRole.get(m.job.id)!;
        role.companies.add(identity.key);
        role.jobs.push(other);

        let agg = companies.get(identity.key);
        if (!agg) {
          agg = { ...identity, jobs: new Map(), matchedRoles: new Set(), latest: new Date(0) };
          companies.set(identity.key, agg);
        }
        // One job can resemble several of yours; it is still one job.
        if (!agg.jobs.has(other.id)) agg.jobs.set(other.id, { job: other, reason, matchedRole: m.job.title });
        agg.matchedRoles.add(m.job.title);
        const posted = other.publishedAt ?? other.createdAt;
        if (posted > agg.latest) agg.latest = posted;
      }
    }

    const ranked = [...companies.values()].sort(
      (a, b) => b.jobs.size - a.jobs.size || b.latest.getTime() - a.latest.getTime(),
    );
    const totalJobs = ranked.reduce((n, c) => n + c.jobs.size, 0);

    return {
      summary: { companies: ranked.length, jobs: totalJobs, rolesCompared: mine.length },
      companies: ranked.slice(0, TOP_COMPANIES).map((c) => ({
        name: c.name,
        logo: c.logo,
        /** Links to the public company page; null for admin-posted jobs with no linked employer. */
        profileId: c.profileId,
        similarJobs: c.jobs.size,
        yourRoles: [...c.matchedRoles],
        latestPostedAt: c.latest.toISOString(),
        examples: [...c.jobs.values()]
          .sort((a, b) => this.postedAt(b.job) - this.postedAt(a.job))
          .slice(0, EXAMPLES_PER_COMPANY)
          .map(({ job, reason, matchedRole }) => ({
            jobId: job.id,
            title: job.title,
            location: job.isRemote ? 'Remote' : job.location,
            similarTo: matchedRole,
            reason: reason.kind === 'title' ? 'Same role' : `${reason.shared.length} shared skills`,
          })),
      })),
      roles: mine.map((j) => {
        const role = perRole.get(j.id)!;
        return {
          jobId: j.id,
          title: j.title,
          competingCompanies: role.companies.size,
          competingJobs: role.jobs.length,
          pay: this.payComparison(j, role.jobs),
        };
      }),
      note,
    };
  }

  /**
   * What the similar posts offer, against what you offer.
   *
   * Only posts in the same currency and the same stated period are compared —
   * converting would need exchange rates and hours we do not have, and a
   * missing period is not assumed to be annual. Below a handful of posts there
   * is no median, only the count.
   */
  private payComparison(own: JobRow, similar: JobRow[]) {
    const period = this.period(own.salaryPeriod);
    const yours = this.midpoint(own);
    const comparable =
      period === null
        ? []
        : similar
            .filter((j) => j.salaryCurrency === own.salaryCurrency && this.period(j.salaryPeriod) === period)
            .map((j) => this.midpoint(j))
            .filter((m): m is number => m !== null);

    return {
      currency: own.salaryCurrency,
      period: own.salaryPeriod,
      yours,
      samples: comparable.length,
      median: comparable.length >= MIN_PAY_SAMPLES ? this.median(comparable) : null,
    };
  }

  private companyOf(job: OtherJobRow) {
    const profile = job.postedBy?.employerProfile ?? null;
    // An admin's manual override names a company that has no account here.
    if (job.companyName) {
      return {
        key: `name:${job.companyName.trim().toLowerCase()}`,
        name: job.companyName,
        logo: job.companyLogo,
        profileId: null,
      };
    }
    return {
      key: profile?.companyId ? `company:${profile.companyId}` : `user:${job.postedById}`,
      name: profile?.companyName || 'Unnamed company',
      logo: profile?.companyLogo ?? null,
      profileId: profile?.id ?? null,
    };
  }

  private period(p: string | null): string | null {
    const v = p?.trim().toLowerCase();
    return v ? v : null;
  }

  private midpoint(j: JobRow): number | null {
    if (j.salaryMin != null && j.salaryMax != null) return Math.round((j.salaryMin + j.salaryMax) / 2);
    return j.salaryMin ?? j.salaryMax ?? null;
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }

  private postedAt(j: JobRow): number {
    return (j.publishedAt ?? j.createdAt).getTime();
  }
}
