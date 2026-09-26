import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { User } from '../common/types/user.types';

const DAY_MS = 86_400_000;

/** Views a job needs before "no applications" means anything. */
const VIEWS_BEFORE_CONVERSION_MATTERS = 25;
/** Days a job must be live before silence is worth flagging. */
const STALE_JOB_DAYS = 14;
/** Days an interview can sit without an outcome before it's ghosting. */
const OUTCOME_OVERDUE_DAYS = 5;
/** Supply below this, against real demand, is a hiring risk worth naming. */
const SCARCE_SUPPLY = 3;

export type InsightKind = 'action' | 'attention' | 'observation';

export interface Insight {
  id: string;
  kind: InsightKind;
  title: string;
  body: string;
  /** The numbers the rule fired on, so the claim is checkable. */
  evidence: string;
  link: string | null;
  linkLabel: string | null;
  /** How many people or posts this concerns. Used for ordering, never invented. */
  affected: number;
}

/**
 * Deterministic insights for the employer dashboard.
 *
 * Every insight is a threshold rule over records that exist. There is no model
 * here and no confidence score: a rule either fired or it didn't, and attaching
 * "92% confident" to a database count would be theatre — the previous version
 * of this feature did exactly that over invented claims.
 *
 * Rules must be: true by construction, checkable from the evidence string, and
 * linked to the place the employer can act. Anything that can't meet all three
 * doesn't belong here.
 */
@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
  ) {}

  async forEmployer(user: User): Promise<{ insights: Insight[]; generatedAt: string }> {
    const memberIds = await this.companyContext.memberUserIds(user.id);
    const jobs = await this.prisma.job.findMany({
      where: { postedById: { in: memberIds } },
      select: { id: true, title: true, status: true, publishedAt: true, skills: true },
    });
    const jobIds = jobs.map((j) => j.id);

    const results = await Promise.all([
      this.jobsWithViewsNoApplications(jobs, jobIds),
      this.staleLiveJobs(jobs),
      this.unreviewedApplications(jobIds),
      this.completedScreenings(user.id),
      this.unacknowledgedAccommodations(user.id),
      this.interviewsWithoutOutcome(user.id),
      this.scarceSkills(jobs),
    ]);

    const insights = results
      .flat()
      .sort((a, b) => this.weight(b) - this.weight(a))
      .slice(0, 8);

    return { insights, generatedAt: new Date().toISOString() };
  }

  /** Attention first, then by how many people it concerns. */
  private weight(i: Insight): number {
    const kindScore = i.kind === 'attention' ? 1000 : i.kind === 'action' ? 500 : 0;
    return kindScore + Math.min(i.affected, 499);
  }

  /* --------------------------------- rules -------------------------------- */

  /** Real traffic, zero applications — the post or the apply flow is the problem. */
  private async jobsWithViewsNoApplications(
    jobs: { id: string; title: string; status: string }[],
    jobIds: string[],
  ): Promise<Insight[]> {
    if (jobIds.length === 0) return [];
    const [views, apps] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ['jobId'],
        where: { jobId: { in: jobIds }, type: 'job_view' },
        _count: { _all: true },
      }),
      this.prisma.application.groupBy({
        by: ['jobId'],
        where: { jobId: { in: jobIds } },
        _count: { _all: true },
      }),
    ]);
    const appCount = new Map(apps.map((a) => [a.jobId, a._count._all]));

    return views
      .filter(
        (v) =>
          v._count._all >= VIEWS_BEFORE_CONVERSION_MATTERS && (appCount.get(v.jobId ?? '') ?? 0) === 0,
      )
      .map((v) => {
        const job = jobs.find((j) => j.id === v.jobId);
        return {
          id: `no-conversion-${v.jobId}`,
          kind: 'action' as const,
          title: `"${job?.title ?? 'A job'}" gets views but no applications`,
          body:
            'People are finding this post and leaving without applying. Check the requirements list, the salary range, and how the apply button behaves.',
          evidence: `${v._count._all} views, 0 applications`,
          link: `/employers/jobs/${v.jobId}/edit`,
          linkLabel: 'Review the post',
          affected: v._count._all,
        };
      });
  }

  /** Live for weeks with nothing coming in. */
  private async staleLiveJobs(
    jobs: { id: string; title: string; status: string; publishedAt: Date | null }[],
  ): Promise<Insight[]> {
    const cutoff = new Date(Date.now() - STALE_JOB_DAYS * DAY_MS);
    const candidates = jobs.filter(
      (j) => j.status === 'active' && j.publishedAt && j.publishedAt < cutoff,
    );
    if (candidates.length === 0) return [];

    const apps = await this.prisma.application.groupBy({
      by: ['jobId'],
      where: { jobId: { in: candidates.map((j) => j.id) } },
      _count: { _all: true },
    });
    const withApps = new Set(apps.map((a) => a.jobId));

    return candidates
      .filter((j) => !withApps.has(j.id))
      .map((j) => {
        const days = Math.floor((Date.now() - (j.publishedAt as Date).getTime()) / DAY_MS);
        return {
          id: `stale-${j.id}`,
          kind: 'action' as const,
          title: `"${j.title}" has had no applicants`,
          body:
            'Nobody has applied since it went live. Widening the location or loosening a hard requirement is usually what moves this.',
          evidence: `Live ${days} days, 0 applications`,
          link: `/employers/jobs/${j.id}/edit`,
          linkLabel: 'Edit the job',
          affected: days,
        };
      });
  }

  /** Applications nobody has moved out of the inbox. */
  private async unreviewedApplications(jobIds: string[]): Promise<Insight[]> {
    if (jobIds.length === 0) return [];
    const count = await this.prisma.application.count({
      where: {
        jobId: { in: jobIds },
        status: 'pending',
        appliedAt: { lt: new Date(Date.now() - 3 * DAY_MS) },
      },
    });
    if (count === 0) return [];
    return [
      {
        id: 'unreviewed-applications',
        kind: 'attention',
        title: `${count} application${count === 1 ? '' : 's'} waiting more than 3 days`,
        body:
          'These are still marked new. Candidates who wait without a reply are the ones you lose to faster employers.',
        evidence: `${count} still in "pending" after 3+ days`,
        link: '/employers/candidates',
        linkLabel: 'Open candidates',
        affected: count,
      },
    ];
  }

  /** Finished screenings sitting unread. */
  private async completedScreenings(employerId: string): Promise<Insight[]> {
    const count = await this.prisma.aiScreen.count({
      where: { employerId, status: 'completed' },
    });
    if (count === 0) return [];
    return [
      {
        id: 'completed-screenings',
        kind: 'action',
        title: `${count} screening${count === 1 ? '' : 's'} completed`,
        body: 'Scorecards are ready to review. Scores rank answers — the decision is still yours.',
        evidence: `${count} completed screening${count === 1 ? '' : 's'}`,
        link: '/employers/candidates',
        linkLabel: 'Review scorecards',
        affected: count,
      },
    ];
  }

  /**
   * Adjustment requests nobody has confirmed.
   *
   * Ranked as attention regardless of count: someone asked for what they need
   * to take part on equal terms and is waiting on a person.
   */
  private async unacknowledgedAccommodations(employerId: string): Promise<Insight[]> {
    const screens = await this.prisma.aiScreen.findMany({
      where: { employerId, accommodations: { not: Prisma.DbNull } },
      select: { accommodations: true },
    });
    const pending = screens.filter((s) => {
      const a = s.accommodations as { status?: string; needs?: unknown[] } | null;
      return !!a?.needs?.length && a.status === 'requested';
    }).length;
    if (pending === 0) return [];
    return [
      {
        id: 'pending-accommodations',
        kind: 'attention',
        title: `${pending} candidate${pending === 1 ? '' : 's'} asked for adjustments`,
        body:
          "They're waiting for you to confirm. If a human interviewer was requested, arrange one — that request exists so nobody is forced through an AI-only process.",
        evidence: `${pending} request${pending === 1 ? '' : 's'} not yet acknowledged`,
        link: '/employers/candidates',
        linkLabel: 'Open requests',
        affected: pending + 100, // ranks above ordinary action items
      },
    ];
  }

  /** Interviews that happened with no outcome given to the candidate. */
  private async interviewsWithoutOutcome(employerId: string): Promise<Insight[]> {
    const count = await this.prisma.interview.count({
      where: {
        employerId,
        outcome: null,
        scheduledAt: { lt: new Date(Date.now() - OUTCOME_OVERDUE_DAYS * DAY_MS), not: null },
        status: { in: ['confirmed', 'completed'] },
      },
    });
    if (count === 0) return [];
    return [
      {
        id: 'interviews-no-outcome',
        kind: 'attention',
        title: `${count} interview${count === 1 ? '' : 's'} without an outcome`,
        body:
          'These candidates interviewed and have heard nothing since. A short "no" is worth far more to them than silence.',
        evidence: `Interviewed ${OUTCOME_OVERDUE_DAYS}+ days ago, no outcome recorded`,
        link: '/employers/candidates',
        linkLabel: 'Record outcomes',
        affected: count,
      },
    ];
  }

  /** Skills you ask for that almost nobody on the platform lists. */
  private async scarceSkills(jobs: { status: string; skills: string[] }[]): Promise<Insight[]> {
    const wanted = [
      ...new Set(
        jobs
          .filter((j) => j.status === 'active')
          .flatMap((j) => j.skills.flatMap((s) => s.split(',').map((x) => x.trim())))
          .filter((s) => s.length > 0 && s.length <= 60),
      ),
    ].slice(0, 40);
    if (wanted.length === 0) return [];

    const profiles = await this.prisma.jobSeekerProfile.findMany({
      where: { NOT: { skills: { isEmpty: true } } },
      select: { skills: true },
      take: 5000,
    });

    const scarce = wanted
      .map((skill) => ({
        skill,
        supply: profiles.filter((p) =>
          p.skills.some((s) =>
            s
              .split(',')
              .map((x) => x.trim().toLowerCase())
              .includes(skill.toLowerCase()),
          ),
        ).length,
      }))
      .filter((s) => s.supply <= SCARCE_SUPPLY)
      .sort((a, b) => a.supply - b.supply)
      .slice(0, 1);

    return scarce.map((s) => ({
      id: `scarce-${s.skill}`,
      kind: 'observation' as const,
      title: `Few candidates here list "${s.skill}"`,
      body:
        'Your live posts ask for this, but almost nobody on the platform lists it. Treating it as nice-to-have usually widens the pool more than anything else.',
      evidence: `${s.supply} job seeker${s.supply === 1 ? '' : 's'} list this skill`,
      link: '/employers/analytics',
      linkLabel: null,
      affected: 0,
    }));
  }
}
