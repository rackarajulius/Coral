import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LIVE_JOB_STATUSES } from '../jobs/job-lifecycle.service';
import { User } from '../common/types/user.types';
import { RECOMMEND_MIN_SCORE, scoreJobForProfile } from './job-match.rules';
import {
  JOB_MATCH_SELECT,
  PROFILE_MATCH_SELECT,
  companyOf,
  profileHasSignal,
  toMatchJob,
  toMatchProfile,
} from './match-inputs';

/** Live jobs read per feed request, newest first. */
const FEED_SCAN_LIMIT = 2000;
/** Paid slots at the top of a feed. More and the feed becomes an ad unit. */
export const MAX_PROMOTED_IN_FEED = 2;

export interface RecommendedJob {
  jobId: string;
  title: string;
  company: string;
  companyLogo: string | null;
  location: string | null;
  isRemote: boolean;
  score: number;
  reasons: string[];
  /** On top because the employer paid for reach. Always labelled. */
  promoted: boolean;
  publishedAt: string | null;
}

/**
 * Jobs for one seeker, computed when they look.
 *
 * Nothing is written for showing the feed; a row appears only when the person
 * opens or dismisses an item. That keeps "recommended to 40 people" in the
 * employer's stats a count of deliveries, not of page renders.
 */
@Injectable()
export class JobRecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async forSeeker(user: User, limit = 10): Promise<{ items: RecommendedJob[]; needsProfile: boolean }> {
    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId: user.id },
      select: PROFILE_MATCH_SELECT,
    });
    if (!profile || !profileHasSignal(profile)) return { items: [], needsProfile: true };

    const [jobs, applied, dismissed, boosted] = await Promise.all([
      this.prisma.job.findMany({
        where: { status: { in: LIVE_JOB_STATUSES }, postedById: { not: user.id } },
        select: JOB_MATCH_SELECT,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: FEED_SCAN_LIMIT,
      }),
      this.prisma.application.findMany({ where: { applicantId: user.id }, select: { jobId: true } }),
      this.prisma.jobRecommendation.findMany({
        where: { userId: user.id, dismissedAt: { not: null } },
        select: { jobId: true },
      }),
      this.activeBoostJobIds(),
    ]);

    const skip = new Set([...applied.map((a) => a.jobId), ...dismissed.map((d) => d.jobId)]);
    const match = toMatchProfile(profile);

    const scored: RecommendedJob[] = [];
    for (const job of jobs) {
      if (skip.has(job.id)) continue;
      const result = scoreJobForProfile(toMatchJob(job), match);
      if (!result || result.score < RECOMMEND_MIN_SCORE) continue;
      const company = companyOf(job);
      scored.push({
        jobId: job.id,
        title: job.title,
        company: company.name,
        companyLogo: company.logo,
        location: job.location,
        isRemote: job.isRemote,
        score: result.score,
        reasons: result.reasons,
        promoted: false,
        publishedAt: (job.publishedAt ?? job.createdAt).toISOString(),
      });
    }

    scored.sort((a, b) => b.score - a.score || (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));

    // Boosted jobs that already cleared the same bar take the top slots,
    // labelled. A boost cannot put an irrelevant job here — it was filtered
    // out above with everything else.
    const promoted = scored.filter((r) => boosted.has(r.jobId)).slice(0, MAX_PROMOTED_IN_FEED);
    promoted.forEach((r) => (r.promoted = true));
    const rest = scored.filter((r) => !r.promoted);

    return { items: [...promoted, ...rest].slice(0, limit), needsProfile: false };
  }

  /** Records the first time someone opens a job from a recommendation. */
  async markOpened(user: User, jobId: string): Promise<void> {
    const existing = await this.prisma.jobRecommendation.findUnique({
      where: { jobId_userId: { jobId, userId: user.id } },
      select: { openedAt: true },
    });
    if (existing) {
      if (!existing.openedAt) {
        await this.prisma.jobRecommendation.update({
          where: { jobId_userId: { jobId, userId: user.id } },
          data: { openedAt: new Date() },
        });
      }
      return;
    }
    // Opened from the live feed: there is no row yet, so write one — scored
    // now, which is what the feed showed.
    const seed = await this.seedRow(user, jobId);
    if (!seed) return;
    await this.prisma.jobRecommendation
      .create({ data: { ...seed, source: 'feed', openedAt: new Date() } })
      .catch(() => undefined); // a double-click raced us to it; the first write stands
  }

  /** "Not interested": never shown or sent again. */
  async dismiss(user: User, jobId: string): Promise<void> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!job) throw new NotFoundException('Job not found');
    const seed = (await this.seedRow(user, jobId)) ?? { jobId, userId: user.id, score: 0, reasons: [] };
    await this.prisma.jobRecommendation.upsert({
      where: { jobId_userId: { jobId, userId: user.id } },
      create: { ...seed, source: 'feed', dismissedAt: new Date() },
      update: { dismissedAt: new Date() },
    });
  }

  async undismiss(user: User, jobId: string): Promise<void> {
    await this.prisma.jobRecommendation.updateMany({
      where: { jobId, userId: user.id },
      data: { dismissedAt: null },
    });
  }

  /** Jobs with a boost running now. */
  async activeBoostJobIds(): Promise<Set<string>> {
    const rows = await this.prisma.jobBoost.findMany({
      where: { status: 'active', endsAt: { gt: new Date() } },
      select: { jobId: true },
    });
    return new Set(rows.map((r) => r.jobId));
  }

  private async seedRow(user: User, jobId: string) {
    const [job, profile] = await Promise.all([
      this.prisma.job.findUnique({ where: { id: jobId }, select: JOB_MATCH_SELECT }),
      this.prisma.jobSeekerProfile.findUnique({ where: { userId: user.id }, select: PROFILE_MATCH_SELECT }),
    ]);
    if (!job) return null;
    const result = profile ? scoreJobForProfile(toMatchJob(job), toMatchProfile(profile)) : null;
    return { jobId, userId: user.id, score: result?.score ?? 0, reasons: result?.reasons ?? [] };
  }
}
