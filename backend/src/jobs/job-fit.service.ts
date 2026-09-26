import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, ResumeTailoring } from '../services/ai/ai.service';
import { RESUME_BUCKET, StorageService } from '../storage/storage.service';
import { User } from '../common/types/user.types';
import { LIVE_JOB_STATUSES } from './job-lifecycle.service';

export interface JobFit {
  /** Skills the job asks for that the candidate demonstrably has. */
  matchedSkills: string[];
  /** Skills the job asks for that we can't find on the candidate. */
  missingSkills: string[];
  /** AI verdict, grounded in the profile. Null when we can't judge. */
  verdict: string | null;
  gaps: string[];
  /** True when the job lists no skills — nothing to compare against. */
  jobListsNoSkills: boolean;
  /** True when the candidate has no skills on file. */
  noProfileSignal: boolean;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * How long one person's verdict for one job is reused.
 *
 * The skills comparison is cheap and always recomputed; the AI verdict is the
 * expensive half, and it only changes when the profile or the posting changes
 * — both of which are part of the key, so this window is about the model's
 * wording, not about stale facts.
 */
const VERDICT_TTL_MS = 30 * 60_000;
const VERDICT_MAX_ENTRIES = 2_000;

@Injectable()
export class JobFitService {
  private readonly logger = new Logger(JobFitService.name);
  /** `user:job:profileVersion:jobVersion` → the AI half of the fit. */
  private readonly verdicts = new Map<string, { until: number; value: { verdict: string | null; gaps: string[] } }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Fit and tailoring read the job's text, so they follow the job page's rule:
   * live jobs, or one the candidate applied to (an employer often closes a
   * posting while still interviewing). A draft's text is never read.
   */
  private async maySee(user: User, job: { id: string; status: string }): Promise<boolean> {
    if (LIVE_JOB_STATUSES.includes(job.status) || user.role === 'ADMIN') return true;
    const applied = await this.prisma.application.findFirst({
      where: { jobId: job.id, applicantId: user.id },
      select: { id: true },
    });
    return !!applied;
  }

  /**
   * Fit breakdown for one job.
   *
   * Matched/missing skills are computed by EXACT comparison, not asked of the
   * LLM — it's cheaper, deterministic, and can't hallucinate a skill the
   * candidate never listed. The AI only supplies the qualitative verdict.
   */
  async getFit(user: User, jobId: string): Promise<JobFit> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, skills: true, description: true, status: true, updatedAt: true },
    });
    if (!job || !(await this.maySee(user, job))) throw new NotFoundException('Job not found');

    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId: user.id },
      select: {
        headline: true,
        summary: true,
        skills: true,
        parsedResume: true,
        updatedAt: true,
        experiences: { orderBy: { startDate: 'desc' }, take: 6, select: { title: true, company: true } },
      },
    });

    const parsed = (profile?.parsedResume ?? {}) as { skills?: string[] };
    const mySkills = [...new Set([...(parsed.skills ?? []), ...(profile?.skills ?? [])])];
    const mySet = new Set(mySkills.map(norm));

    const jobSkills = job.skills ?? [];
    const matchedSkills = jobSkills.filter((s) => mySet.has(norm(s)));
    const missingSkills = jobSkills.filter((s) => !mySet.has(norm(s)));

    const noProfileSignal = mySkills.length === 0 && !profile?.summary?.trim();
    const base: JobFit = {
      matchedSkills,
      missingSkills,
      verdict: null,
      gaps: [],
      jobListsNoSkills: jobSkills.length === 0,
      noProfileSignal,
    };
    if (noProfileSignal) return base;

    // Opening the same job again — or coming back to it after reading a few
    // others — costs nothing. Without this, every click on a job listing ran
    // the model again.
    const key = [user.id, job.id, profile?.updatedAt?.getTime() ?? 0, job.updatedAt.getTime()].join(':');
    const cached = this.verdicts.get(key);
    if (cached && cached.until > Date.now()) {
      return { ...base, ...cached.value };
    }
    if (cached) this.verdicts.delete(key);

    try {
      const readiness = await this.ai.analyzeRoleReadiness({
        targetRole: job.title,
        profileSnapshot: {
          headline: profile?.headline ?? '',
          summary: (profile?.summary ?? '').slice(0, 800),
          skills: mySkills.slice(0, 30),
          experiences: (profile?.experiences ?? []).map((e) => `${e.title} @ ${e.company}`),
          jobRequires: jobSkills.slice(0, 25),
        },
      });
      const value = { verdict: readiness.verdict || null, gaps: readiness.gaps ?? [] };
      this.remember(key, value);
      return { ...base, ...value };
    } catch (err) {
      this.logger.warn(`Fit analysis failed: ${err instanceof Error ? err.message : err}`);
      return base; // deterministic half still stands
    }
  }

  private remember(key: string, value: { verdict: string | null; gaps: string[] }): void {
    if (this.verdicts.size >= VERDICT_MAX_ENTRIES) {
      const now = Date.now();
      for (const [k, v] of this.verdicts) if (v.until <= now) this.verdicts.delete(k);
      // Still full: drop the oldest (a Map iterates in insertion order).
      for (const k of this.verdicts.keys()) {
        if (this.verdicts.size < VERDICT_MAX_ENTRIES) break;
        this.verdicts.delete(k);
      }
    }
    this.verdicts.set(key, { until: Date.now() + VERDICT_TTL_MS, value });
  }

  /**
   * Rewrites the candidate's stored resume toward this job. Grounded in their
   * real resume text — the prompt forbids inventing experience.
   */
  async tailorForJob(user: User, jobId: string): Promise<ResumeTailoring> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, companyName: true, location: true, description: true, skills: true, status: true },
    });
    if (!job || !(await this.maySee(user, job))) throw new NotFoundException('Job not found');

    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId: user.id },
      select: { resumePath: true, resumeFileName: true },
    });
    if (!profile?.resumePath) {
      throw new BadRequestException(
        'Add a resume to your profile first — tailoring works from your real resume.',
      );
    }

    const bytes = await this.storage.downloadFile(profile.resumePath, RESUME_BUCKET);
    if (!bytes) throw new BadRequestException("We couldn't read your stored resume. Try re-uploading it.");

    const text = await this.extractText(bytes, profile.resumeFileName ?? '');
    if (!text.trim()) {
      throw new BadRequestException('No readable text in your resume — try a PDF or Word export.');
    }

    return this.ai.tailorResume(text, {
      title: job.title,
      company: job.companyName ?? '',
      location: job.location ?? '',
      description: [job.skills.join(', '), (job.description ?? '').slice(0, 1500)]
        .filter(Boolean)
        .join('\n'),
    });
  }

  private async extractText(buffer: Buffer, fileName: string): Promise<string> {
    const lower = fileName.toLowerCase();
    try {
      if (lower.endsWith('.pdf')) return (await pdfParse(buffer)).text ?? '';
      if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
        return (await mammoth.extractRawText({ buffer })).value ?? '';
      }
      return buffer.toString('utf8');
    } catch {
      // Unknown/!corrupt format — fall back to a plain read rather than failing hard.
      return buffer.toString('utf8');
    }
  }
}
