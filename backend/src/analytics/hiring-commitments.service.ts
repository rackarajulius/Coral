import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { LIVE_JOB_STATUSES } from '../jobs/job-lifecycle.service';
import { asksForCanadianExperience, payRangeTooWide, statesPay } from '../jobs/posting-statements';
import { median } from './hiring-stats.service';

const DAY_MS = 86_400_000;

/** Ontario's deadline (2026-01-01) for telling an interviewed applicant where things stand. */
export const OUTCOME_DEADLINE_DAYS = 45;

/** Employers are warned of interviews this old with no word, ahead of the deadline. */
const DUE_SOON_DAYS = 35;

/** How far back interviews are looked at. */
const WINDOW_DAYS = 365;

/**
 * Interviews needed before the after-interview figures are shown. Below this
 * a single candidate swings the rate by whole points, and a company would be
 * judged in public on noise (the same reasoning as the hiring stats).
 */
const MIN_INTERVIEWS = 10;

export interface PostingFacts {
  /** Live postings the facts are drawn from. */
  open: number;
  /** State a pay figure or range. */
  withPay: number;
  /** Say whether the role is open now or for future openings. */
  vacancyStated: number;
  /** Of those, gathering candidates for future openings rather than open now. */
  futureOpenings: number;
  /** Say AI is used to screen, assess or select applicants. */
  usingAi: number;
}

export interface OutcomeFacts {
  /** False below the sample threshold; the figures are then null. */
  available: boolean;
  /** Interviews judged: answered, or past the deadline without an answer. */
  measured: number;
  deadlineDays: number;
  /** Share told where they stand within the deadline after their last interview, 0-100. */
  withinDeadlineRate: number | null;
  /** Median days from the last interview to hearing. */
  medianDaysToOutcome: number | null;
}

export interface HiringCommitments {
  postings: PostingFacts;
  afterInterview: OutcomeFacts;
}

export interface JobRef {
  id: string;
  title: string;
}

/** What the employer can fix. Theirs only: the public page carries aggregates. */
export interface CommitmentsToFix {
  missingPay: JobRef[];
  payRangeTooWide: JobRef[];
  vacancyUnstated: JobRef[];
  canadianExperience: JobRef[];
  /** Interviewed candidates past day 35 with no word yet. */
  outcomesDueSoon: number;
  /** Past the deadline with no word. */
  outcomesOverdue: number;
}

interface Interviewed {
  candidateId: string;
  role: string | null;
  scheduledAt: Date | null;
  outcomeAt: Date | null;
}

/**
 * Each candidate's LAST interview for a role: the deadline runs from it, and
 * an "advancing" after round one doesn't answer round two.
 */
function lastInterviews(rows: Interviewed[]): Array<{ scheduledAt: Date; outcomeAt: Date | null }> {
  const last = new Map<string, { scheduledAt: Date; outcomeAt: Date | null }>();
  for (const row of rows) {
    if (!row.scheduledAt) continue;
    const key = `${row.candidateId}|${(row.role ?? '').trim().toLowerCase()}`;
    const seen = last.get(key);
    if (!seen || row.scheduledAt > seen.scheduledAt) {
      last.set(key, { scheduledAt: row.scheduledAt, outcomeAt: row.outcomeAt });
    }
  }
  return [...last.values()];
}

/**
 * Hiring commitments, checked: what a company's postings say about pay, real
 * vacancies and AI, and whether interviewed candidates hear back within 45
 * days — the things Ontario has required of postings since 2026-01-01.
 *
 * LinkedIn's "commitments" are statements a company writes about itself. These
 * are read from its postings and its interviews, so nobody at the company can
 * edit them. They are facts, never a "compliant" badge: Coral doesn't know the
 * company's headcount or province, and legal advice isn't ours to give.
 *
 * The after-interview figures follow the hiring stats' rules: measured from
 * when an outcome was recorded (`Interview.outcomeAt`), never estimated;
 * interviews younger than the deadline and still unanswered aren't judged yet;
 * and nothing is shown below {@link MIN_INTERVIEWS}.
 */
@Injectable()
export class HiringCommitmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /** The public facts. `ownerUserId` is the employer profile's owning user. */
  async forCompany(ownerUserId: string): Promise<HiringCommitments> {
    const { jobs, interviews, now } = await this.load(ownerUserId);
    return { postings: this.postingFacts(jobs), afterInterview: this.outcomeFacts(interviews, now) };
  }

  /** The same, for the company itself, with what it can fix. */
  async forEmployer(ownerUserId: string): Promise<HiringCommitments & { toFix: CommitmentsToFix }> {
    const { jobs, interviews, now } = await this.load(ownerUserId);
    const ref = (j: { id: string; title: string }): JobRef => ({ id: j.id, title: j.title });
    const unanswered = interviews.filter((iv) => !iv.outcomeAt);
    const age = (iv: { scheduledAt: Date }) => now - iv.scheduledAt.getTime();
    return {
      postings: this.postingFacts(jobs),
      afterInterview: this.outcomeFacts(interviews, now),
      toFix: {
        missingPay: jobs.filter((j) => !statesPay(j)).map(ref),
        payRangeTooWide: jobs.filter(payRangeTooWide).map(ref),
        vacancyUnstated: jobs.filter((j) => j.existingVacancy === null).map(ref),
        canadianExperience: jobs.filter((j) => asksForCanadianExperience(j.description, j.requirements)).map(ref),
        outcomesDueSoon: unanswered.filter(
          (iv) => age(iv) >= DUE_SOON_DAYS * DAY_MS && age(iv) < OUTCOME_DEADLINE_DAYS * DAY_MS,
        ).length,
        outcomesOverdue: unanswered.filter((iv) => age(iv) >= OUTCOME_DEADLINE_DAYS * DAY_MS).length,
      },
    };
  }

  private async load(ownerUserId: string) {
    const memberIds = await this.companyContext.memberUserIds(ownerUserId);
    const now = Date.now();
    const [jobs, rows] = await Promise.all([
      this.prisma.job.findMany({
        where: { postedById: { in: memberIds }, status: { in: LIVE_JOB_STATUSES } },
        select: {
          id: true, title: true, description: true, requirements: true,
          salaryMin: true, salaryMax: true, salaryPeriod: true, existingVacancy: true, usesAi: true,
        },
        orderBy: { publishedAt: 'desc' },
      }),
      this.prisma.interview.findMany({
        where: {
          employerId: { in: memberIds },
          // Interviews that happened, or were set to: proposed ones never had
          // a time, and declined or cancelled ones didn't take place.
          status: { in: ['confirmed', 'completed'] },
          scheduledAt: { gte: new Date(now - WINDOW_DAYS * DAY_MS), lte: new Date(now) },
        },
        select: { candidateId: true, role: true, scheduledAt: true, outcomeAt: true },
      }),
    ]);
    return { jobs, interviews: lastInterviews(rows), now };
  }

  private postingFacts(
    jobs: Array<{ salaryMin: number | null; salaryMax: number | null; existingVacancy: boolean | null; usesAi: boolean }>,
  ): PostingFacts {
    return {
      open: jobs.length,
      withPay: jobs.filter(statesPay).length,
      vacancyStated: jobs.filter((j) => j.existingVacancy !== null).length,
      futureOpenings: jobs.filter((j) => j.existingVacancy === false).length,
      usingAi: jobs.filter((j) => j.usesAi).length,
    };
  }

  private outcomeFacts(interviews: Array<{ scheduledAt: Date; outcomeAt: Date | null }>, now: number): OutcomeFacts {
    const deadline = OUTCOME_DEADLINE_DAYS * DAY_MS;
    // Judged once answered, or once the deadline has passed. Someone
    // interviewed last week who hasn't heard yet isn't late.
    const judged = interviews.filter((iv) => iv.outcomeAt || now - iv.scheduledAt.getTime() >= deadline);
    const empty: OutcomeFacts = {
      available: false,
      measured: judged.length,
      deadlineDays: OUTCOME_DEADLINE_DAYS,
      withinDeadlineRate: null,
      medianDaysToOutcome: null,
    };
    if (judged.length < MIN_INTERVIEWS) return empty;

    // An outcome recorded before the interview's time is a clock problem, not a negative wait.
    const waits = judged
      .filter((iv) => iv.outcomeAt)
      .map((iv) => Math.max(0, iv.outcomeAt!.getTime() - iv.scheduledAt.getTime()));
    const inTime = waits.filter((ms) => ms <= deadline).length;
    const typical = waits.length >= MIN_INTERVIEWS ? median(waits.map((ms) => ms / DAY_MS)) : null;

    return {
      available: true,
      measured: judged.length,
      deadlineDays: OUTCOME_DEADLINE_DAYS,
      withinDeadlineRate: Math.round((inTime / judged.length) * 100),
      medianDaysToOutcome: typical === null ? null : Math.round(typical * 10) / 10,
    };
  }
}
