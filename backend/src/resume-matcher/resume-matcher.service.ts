import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService, ParsedResume } from '../services/ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { isPremiumUser, isPremiumEnforced } from '../auth/guards/premium.guard';
import { SeekerEntitlementsService } from '../seeker-entitlements/seeker-entitlements.service';
import { User } from '../common/types/user.types';
import { RunMatchDto } from './dto/run-match.dto';
import { AssistDto } from './dto/assist.dto';
import { PlatformJobSource } from './job-sources/platform.source';
import { AdzunaJobSource } from './job-sources/adzuna.source';
import { JSearchJobSource } from './job-sources/jsearch.source';
import { GreenhouseJobSource } from './job-sources/greenhouse.source';
import { LeverJobSource } from './job-sources/lever.source';
import { CandidateJob, JobSource } from './job-sources/types';

const MAX_PER_SOURCE = 15;
const MAX_TO_SCORE = 30;
const TOP_N = 20;

export interface ResumeMatch {
  id: string;
  title: string;
  company: string;
  location: string;
  source: CandidateJob['source'];
  matchScore: number;
  reason?: string;
  url?: string;
  salary?: string;
  description?: string; // truncated — powers cover-letter / tailoring
}

interface Candidate {
  parsed: ParsedResume;
  currentTitle: string;
  city: string;
}

@Injectable()
export class ResumeMatcherService {
  private readonly logger = new Logger(ResumeMatcherService.name);
  private readonly sources: JobSource[];

  constructor(
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly entitlements: SeekerEntitlementsService,
    platform: PlatformJobSource,
    adzuna: AdzunaJobSource,
    jsearch: JSearchJobSource,
    greenhouse: GreenhouseJobSource,
    lever: LeverJobSource,
  ) {
    this.sources = [platform, adzuna, jsearch, greenhouse, lever];
  }

  /** Whether the user can use the matcher (open in dev; premium when enforced). */
  getAccess(user: User) {
    return { isPremium: !isPremiumEnforced(this.config) || isPremiumUser(user) };
  }

  /** Matches the signed-in seeker's stored profile (from onboarding) to jobs. */
  async run(user: User, dto: RunMatchDto) {
    const candidate = await this.loadCandidate(user);
    if (!candidate) {
      return { hasProfile: false, query: (dto.query || '').trim(), matches: [] as ResumeMatch[] };
    }

    const query = this.buildQuery(candidate, dto.query);
    const location = this.buildLocation(candidate, dto.query);
    const search = { query, location, limit: MAX_PER_SOURCE };

    /**
     * Platform jobs for everyone; the web for Premium.
     *
     * Free users used to be refused the matcher outright. Now they get what
     * the free tier promises — jobs posted here, which cost no outside data —
     * and web sources join only when the allowance covers them. While
     * enforcement is off that is everyone, and the use is still counted, so
     * the numbers are real before anyone is charged.
     */
    const web = await this.entitlements.status(user, 'matcher.web');
    const webAllowed = !this.entitlements.isEnforced() || web.allowed;
    const enabled = this.sources.filter(
      (s) => s.isEnabled() && (s.name === 'platform' || webAllowed),
    );
    const usedWeb = enabled.some((s) => s.name !== 'platform');

    const settled = await Promise.allSettled(enabled.map((s) => s.search(search)));
    const candidates = this.dedupe(
      settled.flatMap((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        this.logger.warn(`Source ${enabled[i].name} failed: ${r.reason}`);
        return [];
      }),
    ).slice(0, MAX_TO_SCORE);

    const matches = await this.scoreAndRank(candidate.parsed, candidates);
    if (usedWeb) await this.entitlements.record(user.id, 'matcher.web');

    return {
      hasProfile: true,
      query,
      matches,
      /**
       * What was searched, so the page can say so. `platform` with a reason
       * means web results were withheld, not that the web had nothing.
       */
      scope: usedWeb ? ('web' as const) : ('platform' as const),
      webBlockedReason: usedWeb ? null : web.reason,
    };
  }

  coverLetter(user: User, dto: AssistDto) {
    return this.withResumeText(user, (resumeText) => this.ai.generateCoverLetter(resumeText, dto.job));
  }

  tailor(user: User, dto: AssistDto) {
    return this.withResumeText(user, (resumeText) => this.ai.tailorResume(resumeText, dto.job));
  }

  private async withResumeText<T>(user: User, fn: (resumeText: string) => Promise<T>): Promise<T> {
    const candidate = await this.loadCandidate(user);
    if (!candidate) {
      throw new BadRequestException('Complete your profile before using this feature.');
    }
    return fn(this.synthesizeResumeText(candidate.parsed));
  }

  /* --------------------------- profile loading --------------------------- */

  /** Builds a resume-shaped profile from the seeker's stored JobSeekerProfile. */
  private async loadCandidate(user: User): Promise<Candidate | null> {
    const p = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId: user.id },
      include: {
        experiences: { orderBy: { startDate: 'desc' }, take: 15 },
        educations: { orderBy: { startDate: 'desc' }, take: 10 },
      },
    });
    if (!p) return null;

    const parsed: ParsedResume = {
      name: user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || '',
      headline: p.headline ?? '',
      summary: p.summary ?? '',
      skills: p.skills ?? [],
      languages: p.languages ?? [],
      experiences: p.experiences.map((e) => ({
        title: e.title,
        company: e.company,
        location: e.location ?? '',
        period: this.formatPeriod(e.startDate, e.endDate, e.current),
        description: e.description ?? '',
      })),
      educations: p.educations.map((e) => ({
        degree: [e.degree, e.fieldOfStudy].filter(Boolean).join(', '),
        school: e.institution,
        location: e.location ?? '',
        period: this.formatPeriod(e.startDate, e.endDate, e.current),
        description: e.description ?? '',
      })),
    };

    // Needs at least something to match on.
    if (parsed.skills.length === 0 && parsed.experiences.length === 0 && !parsed.headline && !p.currentTitle) {
      return null;
    }

    return { parsed, currentTitle: p.currentTitle ?? '', city: p.city ?? '' };
  }

  private formatPeriod(start: Date | null, end: Date | null, current: boolean): string {
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (!start) return '';
    return `${fmt(start)} - ${current ? 'Present' : end ? fmt(end) : 'Present'}`;
  }

  private synthesizeResumeText(p: ParsedResume): string {
    const lines: string[] = [];
    if (p.name) lines.push(p.name);
    if (p.headline) lines.push(p.headline);
    if (p.summary) lines.push(`\nSummary:\n${p.summary}`);
    if (p.skills.length) lines.push(`\nSkills: ${p.skills.join(', ')}`);
    if (p.experiences.length) {
      lines.push('\nExperience:');
      for (const e of p.experiences) {
        lines.push(`- ${e.title} @ ${e.company} (${e.period})${e.description ? `: ${e.description}` : ''}`);
      }
    }
    if (p.educations.length) {
      lines.push('\nEducation:');
      for (const e of p.educations) lines.push(`- ${e.degree}, ${e.school} (${e.period})`);
    }
    return lines.join('\n');
  }

  /* ----------------------------- matching -------------------------------- */

  private buildQuery(c: Candidate, provided?: string): string {
    if (provided?.trim()) return provided.trim().slice(0, 120);
    const role =
      c.currentTitle ||
      c.parsed.experiences[0]?.title ||
      c.parsed.headline ||
      c.parsed.skills.slice(0, 2).join(' ') ||
      'jobs';
    return role.slice(0, 120);
  }

  private buildLocation(c: Candidate, provided?: string): string {
    // An explicit search overrides; otherwise fall back to the profile city (if any).
    return provided?.trim() ? '' : c.city.trim();
  }

  private dedupe(jobs: CandidateJob[]): CandidateJob[] {
    const seen = new Set<string>();
    const out: CandidateJob[] = [];
    for (const j of jobs) {
      const key = `${j.title}|${j.company}`.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(j);
    }
    return out;
  }

  private async scoreAndRank(profile: ParsedResume, candidates: CandidateJob[]): Promise<ResumeMatch[]> {
    if (candidates.length === 0) return [];

    const aiById = new Map<string, { score: number; reason: string }>();
    try {
      const scores = await this.ai.scoreJobMatches(profile, candidates);
      for (const s of scores) aiById.set(s.id, { score: s.score, reason: s.reason });
    } catch (err) {
      this.logger.warn(`AI scoring unavailable, using heuristic: ${err instanceof Error ? err.message : err}`);
    }

    return candidates
      .map<ResumeMatch>((j) => {
        const ai = aiById.get(j.id);
        return {
          id: j.id,
          title: j.title,
          company: j.company,
          location: j.location,
          source: j.source,
          url: j.url,
          salary: j.salary,
          matchScore: ai?.score ?? this.heuristicScore(profile, j),
          reason: ai?.reason || undefined,
          description: (j.description || '').slice(0, 1500) || undefined,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, TOP_N);
  }

  private heuristicScore(profile: ParsedResume, job: CandidateJob): number {
    const hay = `${job.title} ${job.description}`.toLowerCase();
    const skills = profile.skills.map((s) => s.toLowerCase()).filter((s) => s.length > 2);
    const hits = skills.reduce((n, s) => (hay.includes(s) ? n + 1 : n), 0);
    return Math.min(95, 40 + hits * 12);
  }
}
