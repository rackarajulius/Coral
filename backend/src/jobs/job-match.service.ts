import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../services/ai/ai.service';
import { User } from '../common/types/user.types';

export interface JobMatch {
  jobId: string;
  /** 0-100, or null when we genuinely can't judge (no profile signal). */
  score: number | null;
  /** Why — grounded in the candidate's real skills/experience. */
  reason: string | null;
}

/** Cached scores live this long; a resume or job edit is rare within the window. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class JobMatchService {
  private readonly logger = new Logger(JobMatchService.name);

  /** key = `${userId}:${jobId}` → score, so a scroll back up costs nothing. */
  private readonly cache = new Map<string, { value: JobMatch; at: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /**
   * Scores the jobs currently on screen against the signed-in candidate's
   * profile. Returns `score: null` rather than inventing a number when there's
   * nothing to judge on — the UI shows "—" and explains why.
   */
  async scoreForUser(user: User, jobIds: string[]): Promise<JobMatch[]> {
    const ids = [...new Set(jobIds)].slice(0, 30);
    if (ids.length === 0) return [];

    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId: user.id },
      select: {
        headline: true,
        summary: true,
        skills: true,
        parsedResume: true,
        experiences: {
          orderBy: { startDate: 'desc' },
          take: 6,
          select: { title: true, company: true },
        },
      },
    });

    // Prefer resume skills (richer), fall back to profile skills.
    const parsed = (profile?.parsedResume ?? {}) as { skills?: string[] };
    const skills = (parsed.skills?.length ? parsed.skills : profile?.skills) ?? [];

    // No signal to judge on → say so honestly instead of guessing.
    const hasSignal = skills.length > 0 || !!profile?.summary?.trim() || (profile?.experiences?.length ?? 0) > 0;
    if (!hasSignal) {
      return ids.map((jobId) => ({ jobId, score: null, reason: null }));
    }

    const now = Date.now();
    const results: JobMatch[] = [];
    const missing: string[] = [];
    for (const jobId of ids) {
      const hit = this.cache.get(`${user.id}:${jobId}`);
      if (hit && now - hit.at < CACHE_TTL_MS) results.push(hit.value);
      else missing.push(jobId);
    }
    if (missing.length === 0) return results;

    const jobs = await this.prisma.job.findMany({
      where: { id: { in: missing }, status: 'active' },
      select: { id: true, title: true, companyName: true, location: true, description: true, skills: true },
    });

    try {
      const scored = await this.ai.scoreJobMatches(
        {
          headline: profile?.headline ?? undefined,
          summary: (profile?.summary ?? '').slice(0, 800) || undefined,
          skills: skills.slice(0, 30),
          experiences: profile?.experiences ?? [],
        },
        jobs.map((j) => ({
          id: j.id,
          title: j.title,
          company: j.companyName ?? '',
          location: j.location ?? '',
          // Skills matter more than prose for fit; keep the payload small.
          description: [j.skills.join(', '), (j.description ?? '').slice(0, 900)]
            .filter(Boolean)
            .join('\n'),
        })),
      );

      const byId = new Map(scored.map((s) => [s.id, s]));
      for (const jobId of missing) {
        const s = byId.get(jobId);
        const value: JobMatch = s
          ? { jobId, score: s.score, reason: s.reason || null }
          : { jobId, score: null, reason: null };
        this.cache.set(`${user.id}:${jobId}`, { value, at: now });
        results.push(value);
      }
    } catch (err) {
      this.logger.warn(`Job match scoring failed: ${err instanceof Error ? err.message : err}`);
      // Degrade to "unknown" — never a fabricated score.
      for (const jobId of missing) results.push({ jobId, score: null, reason: null });
    }

    return results;
  }
}
