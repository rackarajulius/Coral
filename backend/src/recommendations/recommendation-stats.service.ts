import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { User } from '../common/types/user.types';
import { JobBoostService } from './job-boost.service';

/** Jobs listed on the reach table: the ones anyone is still likely to ask about. */
const RECENT_JOB_DAYS = 180;
const MAX_JOBS = 200;

export interface JobReach {
  jobId: string;
  title: string;
  status: string;
  /** Sent in a digest. */
  delivered: number;
  /** Of those, reached because of a boost. */
  deliveredByBoost: number;
  /** Matched and waiting for the person's next digest. */
  queued: number;
  /** Opened the job from a recommendation (digest or feed). */
  opened: number;
  /** Applied after opening it from a recommendation. */
  applied: number;
  dismissed: number;
  boost: ReturnType<JobBoostService['present']> | null;
}

/**
 * How far each job travelled through recommendations, and what came of it.
 *
 * "Applied" is attributed, not guessed: an application counts only when the
 * same person opened the job from a recommendation *before* applying. Someone
 * who was sent it, ignored it and found it through search is not counted —
 * the number is a floor on what recommendations did, not a ceiling.
 */
@Injectable()
export class RecommendationStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly boosts: JobBoostService,
  ) {}

  async forEmployer(user: User): Promise<{ jobs: JobReach[]; allowance: Awaited<ReturnType<JobBoostService['allowance']>> }> {
    const memberIds = await this.companyContext.memberUserIds(user.id);
    const jobs = await this.prisma.job.findMany({
      where: {
        postedById: { in: memberIds },
        updatedAt: { gte: new Date(Date.now() - RECENT_JOB_DAYS * 86_400_000) },
      },
      select: { id: true, title: true, status: true },
      orderBy: { updatedAt: 'desc' },
      take: MAX_JOBS,
    });
    const allowance = await this.boosts.allowance(user);
    if (jobs.length === 0) return { jobs: [], allowance };

    const jobIds = jobs.map((j) => j.id);
    const count = (where: object) =>
      this.prisma.jobRecommendation
        .groupBy({ by: ['jobId'], where: { jobId: { in: jobIds }, ...where }, _count: { _all: true } })
        .then((rows) => new Map(rows.map((r) => [r.jobId, r._count._all])));

    const [delivered, deliveredByBoost, queued, dismissed, openedRows, boostRows] = await Promise.all([
      count({ notifiedAt: { not: null } }),
      count({ notifiedAt: { not: null }, promoted: true }),
      count({ notifiedAt: null, openedAt: null, dismissedAt: null }),
      count({ dismissedAt: { not: null } }),
      this.prisma.jobRecommendation.findMany({
        where: { jobId: { in: jobIds }, openedAt: { not: null } },
        select: { jobId: true, userId: true, openedAt: true },
      }),
      this.prisma.jobBoost.findMany({
        where: { jobId: { in: jobIds } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const applications = openedRows.length
      ? await this.prisma.application.findMany({
          where: { jobId: { in: jobIds }, applicantId: { in: [...new Set(openedRows.map((r) => r.userId))] } },
          select: { jobId: true, applicantId: true, appliedAt: true },
        })
      : [];
    const appliedAt = new Map(applications.map((a) => [`${a.jobId}:${a.applicantId}`, a.appliedAt]));

    const opened = new Map<string, number>();
    const applied = new Map<string, number>();
    for (const r of openedRows) {
      opened.set(r.jobId, (opened.get(r.jobId) ?? 0) + 1);
      const at = appliedAt.get(`${r.jobId}:${r.userId}`);
      if (at && r.openedAt && at >= r.openedAt) applied.set(r.jobId, (applied.get(r.jobId) ?? 0) + 1);
    }

    const latestBoost = new Map<string, (typeof boostRows)[number]>();
    for (const b of boostRows) if (!latestBoost.has(b.jobId)) latestBoost.set(b.jobId, b);

    return {
      allowance,
      jobs: jobs.map((j) => {
        const boost = latestBoost.get(j.id);
        return {
          jobId: j.id,
          title: j.title,
          status: j.status,
          delivered: delivered.get(j.id) ?? 0,
          deliveredByBoost: deliveredByBoost.get(j.id) ?? 0,
          queued: queued.get(j.id) ?? 0,
          opened: opened.get(j.id) ?? 0,
          applied: applied.get(j.id) ?? 0,
          dismissed: dismissed.get(j.id) ?? 0,
          boost: boost ? this.boosts.present(boost) : null,
        };
      }),
    };
  }
}
