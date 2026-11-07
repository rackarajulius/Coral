import { Injectable } from '@nestjs/common';
import { PipelineStage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import {
  PIPELINE_EXITS,
  PIPELINE_LADDER,
  PIPELINE_STAGE_LABELS,
  stageFromApplicationStatus,
} from '../common/pipeline-stage';

const DAY_MS = 86_400_000;

/** How far back we look. Recent enough to predict, long enough to have volume. */
const WINDOW_DAYS = 365;

/**
 * Applications needed before any rate is shown.
 *
 * Below this a single candidate swings the figure by whole percentage points,
 * and a company would be publicly judged on noise. Showing nothing is the
 * honest outcome, not a smaller number.
 */
const MIN_APPLICATIONS = 20;

/** Measured first responses needed before the median is shown. */
const MIN_MEASURED = 10;

/** After this long with no word at all, a candidate has been left waiting. */
const GHOSTED_AFTER_DAYS = 30;

export interface HiringStats {
  /** False when there isn't enough to say anything; nothing else is populated. */
  available: boolean;
  /** Applications the figures are drawn from. Always shown beside them. */
  sampleSize: number;
  windowDays: number;
  /** Share of applications that got any answer at all, 0-100. */
  responseRate: number | null;
  /**
   * Share still waiting with no word after {@link GHOSTED_AFTER_DAYS}, 0-100.
   * Counted only over applications old enough to qualify, so a company is never
   * penalised for applications that simply arrived last week.
   */
  ghostedRate: number | null;
  /** Median days from applying to the first employer action. */
  medianDaysToFirstResponse: number | null;
  /** How many first responses that median is drawn from. */
  measuredResponses: number;
  /** The stages candidates actually reach here, commonest first. */
  stages: Array<{ stage: string; count: number }>;
}

const EMPTY: HiringStats = {
  available: false,
  sampleSize: 0,
  windowDays: WINDOW_DAYS,
  responseRate: null,
  ghostedRate: null,
  medianDaysToFirstResponse: null,
  measuredResponses: 0,
  stages: [],
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * What applying to a company is actually like.
 *
 * Candidates' most common complaint is silence, and nobody can answer it
 * because nobody holds the data — a job board sees the click, not what happened
 * afterwards. We run the pipeline, so we do.
 *
 * Three rules keep the number worth trusting:
 *
 * - **Measured, never estimated.** `firstRespondedAt` is written once, when the
 *   employer first acts. Applications from before that column existed are
 *   excluded rather than approximated from `updatedAt`, which records the last
 *   change and would overstate every multi-stage pipeline.
 * - **A candidate's own actions never count.** Withdrawing is not being
 *   answered, so it is excluded from both the numerator and the denominator.
 * - **Silence below the threshold.** A company with nine applications gets no
 *   figures at all, rather than a figure built on nine.
 */
@Injectable()
export class HiringStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /** `ownerUserId` is the employer profile's owning user. */
  async forCompany(ownerUserId: string): Promise<HiringStats> {
    const memberIds = await this.companyContext.memberUserIds(ownerUserId);
    const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS);

    const applications = await this.prisma.application.findMany({
      where: {
        job: { postedById: { in: memberIds } },
        appliedAt: { gte: since },
        // Someone who gave up and withdrew was not answered, and counting them
        // either way would distort the very thing being measured.
        status: { not: 'withdrawn' },
      },
      select: { appliedAt: true, firstRespondedAt: true, status: true },
    });

    if (applications.length < MIN_APPLICATIONS) return EMPTY;

    const answered = applications.filter((a) => a.firstRespondedAt !== null || a.status !== 'pending');

    // Only applications old enough to have been ghosted can count as ghosted.
    const ghostable = applications.filter(
      (a) => a.appliedAt.getTime() <= Date.now() - GHOSTED_AFTER_DAYS * DAY_MS,
    );
    const ghosted = ghostable.filter(
      (a) => a.firstRespondedAt === null && a.status === 'pending',
    );

    const waits = applications
      .filter((a) => a.firstRespondedAt !== null)
      .map((a) => (a.firstRespondedAt!.getTime() - a.appliedAt.getTime()) / DAY_MS)
      // A response recorded before the application is a clock problem, not a
      // negative wait.
      .filter((days) => days >= 0);

    /**
     * How far applicants actually got, for the public page.
     *
     * This counted the legacy `stage` column, which held "Application Sent"
     * for everyone — so a company page promising a measured account of what
     * applying there is like showed one bucket containing everybody. It is
     * derived from `status` now, through the same ladder the boards use.
     */
    const byStage = new Map<PipelineStage, number>();
    for (const a of applications) {
      const stage = stageFromApplicationStatus(a.status);
      byStage.set(stage, (byStage.get(stage) ?? 0) + 1);
    }

    const medianDays = waits.length >= MIN_MEASURED ? median(waits) : null;

    return {
      available: true,
      sampleSize: applications.length,
      windowDays: WINDOW_DAYS,
      responseRate: Math.round((answered.length / applications.length) * 100),
      ghostedRate:
        ghostable.length >= MIN_APPLICATIONS
          ? Math.round((ghosted.length / ghostable.length) * 100)
          : null,
      medianDaysToFirstResponse: medianDays === null ? null : Math.round(medianDays * 10) / 10,
      measuredResponses: waits.length,
      // Ladder order, not by size: this reads as a funnel, and sorting by
      // count would shuffle the rungs out of sequence.
      stages: [...PIPELINE_LADDER, ...PIPELINE_EXITS]
        .filter((stage) => byStage.has(stage))
        .map((stage) => ({ stage: PIPELINE_STAGE_LABELS[stage], count: byStage.get(stage) ?? 0 })),
    };
  }
}
