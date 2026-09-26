import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { PrismaService } from '../prisma/prisma.service';
import { computeMatchScore } from './match-score';

/**
 * Keeps stored match scores in step with their inputs.
 *
 * A score is derived from two things that both change after the application is
 * made: the job's skill list, and the candidate's. Writing it once and never
 * revisiting it would leave employers sorting by a number that stopped being
 * true — which is worse than not storing it, because it looks authoritative.
 *
 * The targeted methods run on edit; the nightly sweep exists because a targeted
 * recompute that silently fails leaves no trace, and drift is invisible.
 */
@Injectable()
export class MatchScoreService {
  private readonly logger = new Logger(MatchScoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** After a job's skills change, rescore everyone who applied to it. */
  async recomputeForJob(jobId: string): Promise<number> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, skills: true },
    });
    if (!job) return 0;

    const applications = await this.prisma.application.findMany({
      where: { jobId },
      select: { id: true, applicant: { select: { jobSeekerProfile: { select: { skills: true } } } } },
    });

    return this.applyAll(
      applications.map((a) => ({
        id: a.id,
        score: computeMatchScore(job.skills, a.applicant.jobSeekerProfile?.skills),
      })),
    );
  }

  /** After a candidate edits their skills, rescore their applications. */
  async recomputeForCandidate(userId: string): Promise<number> {
    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId },
      select: { skills: true },
    });

    const applications = await this.prisma.application.findMany({
      where: { applicantId: userId },
      select: { id: true, job: { select: { skills: true } } },
    });

    return this.applyAll(
      applications.map((a) => ({
        id: a.id,
        score: computeMatchScore(a.job.skills, profile?.skills),
      })),
    );
  }

  /**
   * Nightly reconciliation.
   *
   * Recomputes every application and writes back only where the stored value
   * disagrees, so a missed edit hook self-heals within a day and the write
   * volume stays proportional to actual drift rather than to table size.
   */
  @ExclusiveCron(CronExpression.EVERY_DAY_AT_3AM, { name: 'match-score-reconcile' })
  async reconcile(): Promise<void> {
    const BATCH = 500;
    let cursor: string | undefined;
    let checked = 0;
    let corrected = 0;

    try {
      for (;;) {
        const batch = await this.prisma.application.findMany({
          take: BATCH,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          orderBy: { id: 'asc' },
          select: {
            id: true,
            matchScore: true,
            job: { select: { skills: true } },
            applicant: { select: { jobSeekerProfile: { select: { skills: true } } } },
          },
        });
        if (batch.length === 0) break;

        const drifted = batch
          .map((a) => ({
            id: a.id,
            stored: a.matchScore,
            score: computeMatchScore(a.job.skills, a.applicant.jobSeekerProfile?.skills),
          }))
          .filter((r) => r.stored !== r.score);

        corrected += await this.applyAll(drifted);
        checked += batch.length;
        cursor = batch[batch.length - 1].id;
      }

      if (corrected > 0) {
        this.logger.log(`Match scores reconciled: ${corrected} corrected of ${checked} checked.`);
      }
    } catch (err) {
      this.logger.error(`Match score reconciliation failed: ${(err as Error).message}`);
    }
  }

  /**
   * Groups rows by score so identical values update in one statement — a table
   * of applications usually holds only a few dozen distinct scores.
   */
  private async applyAll(rows: { id: string; score: number | null }[]): Promise<number> {
    if (rows.length === 0) return 0;

    const byScore = new Map<number | null, string[]>();
    for (const r of rows) {
      const list = byScore.get(r.score) ?? [];
      list.push(r.id);
      byScore.set(r.score, list);
    }

    let updated = 0;
    for (const [score, ids] of byScore) {
      const result = await this.prisma.application.updateMany({
        where: { id: { in: ids } },
        data: { matchScore: score },
      });
      updated += result.count;
    }
    return updated;
  }
}
