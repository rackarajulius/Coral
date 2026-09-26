import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';
import { AiService } from '../services/ai/ai.service';
import { SeekerEntitlementsService } from '../seeker-entitlements/seeker-entitlements.service';
import {
  BuildReportDto, CompleteSessionDto, EvaluateAnswerDto, RecordAnswerDto, StartSessionDto,
} from './dto/interview-coach.dto';
import { JobPostingContext, postingContext, practiceJobIdFrom } from './practice-job';
import { LIVE_JOB_STATUSES } from '../jobs/job-lifecycle.service';

type SessionRow = NonNullable<Awaited<ReturnType<PrismaService['interviewCoachSession']['findUnique']>>>;

const asArray = (v: Prisma.JsonValue | undefined): unknown[] => (Array.isArray(v) ? v : []);

/**
 * The name the candidate chose to be greeted by, made safe to speak and show.
 *
 * It arrives inside a free-form config blob, so it is re-cleaned here rather
 * than trusted: letters in any script, marks, spaces, hyphens, apostrophes and
 * full stops, at most 30 characters. Anything else — markup, digits, an
 * attempt to smuggle instructions into the greeting — is dropped.
 */
function callNameFrom(cfg: Record<string, unknown>): string | null {
  if (typeof cfg.callName !== 'string') return null;
  const name = cfg.callName
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\s'’.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 30)
    .trim();
  return name || null;
}

/**
 * Opens the model's greeting with "Hi {name}," — or plain "Hi," when there is
 * no name.
 *
 * The name is added here, after generation, and never put in the prompt: the
 * model has no use for it, and a name is exactly the kind of signal that can
 * tilt a model's judgement of the person. The prompt asks for no salutation,
 * and any the model adds anyway is stripped so the greeting never reads
 * "Hi Bob, Hello there! I'm Nova…".
 */
function addressGreeting(greeting: string, name: string | null): string {
  const body = greeting
    .trim()
    .replace(/^(?:hi|hello|hey|greetings|good (?:morning|afternoon|evening)|welcome)\b(?:\s+there)?[\s,!.—–-]*/i, '')
    .trim();
  return `Hi${name ? ` ${name}` : ''}, ${body}`;
}

@Injectable()
export class InterviewCoachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly entitlements: SeekerEntitlementsService,
  ) {}

  /** Starts a run. Any earlier `active` session is abandoned — one live at a time. */
  async start(user: User, dto: StartSessionDto) {
    // Refused before anything is created, so an exhausted allowance leaves no
    // half-started run behind. Employer screenings never come through here —
    // they are created with the screening — so none of them is checked.
    await this.entitlements.assertAllowed(user, 'coach.session');

    // A run aimed at a real job keeps only the job's id from the client; the
    // title and company stored with it come from the job itself.
    const config: Record<string, unknown> = { ...dto.config };
    const practiceJobId = practiceJobIdFrom(config);
    delete config.practiceJob;
    if (practiceJobId) {
      const job = await this.accessibleJob(user, practiceJobId);
      if (!job) {
        throw new NotFoundException('You can only practise for jobs you have applied to (and not withdrawn from).');
      }
      config.practiceJob = { id: job.id, title: job.title, company: job.company };
    }

    await this.prisma.interviewCoachSession.updateMany({
      where: { userId: user.id, status: 'active' },
      data: { status: 'abandoned' },
    });

    const session = await this.prisma.interviewCoachSession.create({
      data: {
        userId: user.id,
        config: config as Prisma.InputJsonValue,
        questions: (dto.questions ?? []) as unknown as Prisma.InputJsonValue,
      },
    });
    return this.shape(session);
  }

  /** The user's most recent still-active session, for crash/refresh recovery. */
  async getActive(user: User) {
    const session = await this.prisma.interviewCoachSession.findFirst({
      where: { userId: user.id, status: 'active' },
      orderBy: { startedAt: 'desc' },
    });
    return session ? this.shape(session) : null;
  }

  async getOne(user: User, id: string) {
    const session = await this.owned(user, id);
    const report = await this.prisma.interviewCoachReport.findUnique({ where: { sessionId: id } });
    return { ...this.shape(session), report: report?.report ?? null };
  }

  /** Appends one answer + updates running state. Called after each question. */
  async recordAnswer(user: User, id: string, dto: RecordAnswerDto) {
    const session = await this.owned(user, id);
    if (session.status !== 'active') {
      throw new BadRequestException('This interview has already finished.');
    }

    const answers = [...asArray(session.answers), dto.answer];
    const transcript = [...asArray(session.transcript), ...(dto.transcript ?? [])];

    const updated = await this.prisma.interviewCoachSession.update({
      where: { id },
      data: {
        answers: answers as unknown as Prisma.InputJsonValue,
        transcript: transcript as unknown as Prisma.InputJsonValue,
        ...(dto.liveScores ? { liveScores: dto.liveScores as Prisma.InputJsonValue } : {}),
        ...(dto.questionIndex !== undefined ? { questionIndex: dto.questionIndex } : {}),
        ...(dto.durationSec !== undefined ? { durationSec: dto.durationSec } : {}),
      },
    });
    return this.shape(updated);
  }

  /** Finalizes the run and stores its report. Idempotent per session. */
  async complete(user: User, id: string, dto: CompleteSessionDto) {
    const session = await this.owned(user, id);

    const [updated] = await this.prisma.$transaction([
      this.prisma.interviewCoachSession.update({
        where: { id },
        data: {
          status: dto.status ?? 'completed',
          completedAt: new Date(),
          ...(dto.durationSec !== undefined ? { durationSec: dto.durationSec } : {}),
        },
      }),
      this.prisma.interviewCoachReport.upsert({
        where: { sessionId: id },
        create: {
          sessionId: id,
          userId: user.id,
          overallScore: dto.overallScore,
          readiness: dto.readiness,
          report: dto.report as Prisma.InputJsonValue,
        },
        update: {
          overallScore: dto.overallScore,
          readiness: dto.readiness,
          report: dto.report as Prisma.InputJsonValue,
        },
      }),
    ]);
    void session;
    return { ...this.shape(updated), report: dto.report };
  }

  /** Abandons an in-progress run (user left without finishing). */
  async abandon(user: User, id: string) {
    const session = await this.owned(user, id);
    if (session.status !== 'active') return this.shape(session);
    const updated = await this.prisma.interviewCoachSession.update({
      where: { id },
      data: { status: 'abandoned', completedAt: new Date() },
    });
    return this.shape(updated);
  }

  /** History — finished runs, newest first, each with its report. */
  async list(user: User, limit = 50) {
    const sessions = await this.prisma.interviewCoachSession.findMany({
      where: { userId: user.id, status: { in: ['completed', 'abandoned'] } },
      orderBy: { startedAt: 'desc' },
      take: Math.min(limit, 100),
      include: { report: true },
    });
    return sessions.map((s) => ({ ...this.shape(s), report: s.report?.report ?? null }));
  }

  async remove(user: User, id: string) {
    await this.owned(user, id);
    await this.prisma.interviewCoachSession.delete({ where: { id } });
    return { removed: true, id };
  }

  /* ------------------------------ AI engine ------------------------------- */

  /**
   * Plans the interview with the AI, seeded with the user's stored profile so
   * questions reflect their real background. Stores the plan on the session.
   */
  async plan(user: User, id: string) {
    const session = await this.owned(user, id);
    const cfg = (session.config ?? {}) as Record<string, unknown>;

    // An employer screening is not a practice run: the questions were fixed
    // when the round was created and are identical for every candidate, so
    // there is nothing to plan. Personalising here would quietly destroy the
    // comparability the whole round exists to provide.
    if (session.screenId) {
      const questions = asArray(session.questions);
      if (questions.length === 0) {
        throw new BadRequestException('This screening has no questions.');
      }
      const company = typeof cfg.company === 'string' && cfg.company ? cfg.company : 'the employer';
      const greeting =
        `Hi — I'm Nova, and I'll be running this screening interview for ${company}. ` +
        `I have ${questions.length} question${questions.length === 1 ? '' : 's'} about the ${String(cfg.role ?? 'role')}. ` +
        `Take your time, and answer as you would with a human interviewer. Let's begin.`;
      return { greeting, questions, totalQuestions: questions.length };
    }

    /**
     * Planned already: hand back the same questions.
     *
     * Asking the model again would cost another call and, worse, change the
     * questions under a run that already has answers recorded against them.
     * A first attempt that failed leaves `meteredAt` unset, so a retry still
     * reaches the model.
     */
    const planned = asArray(session.questions);
    if (session.meteredAt && planned.length > 0) {
      const greeting = addressGreeting(
        "I'm Nova, your interview coach today. Let's pick up where we left off.",
        callNameFrom(cfg),
      );
      return { greeting, questions: planned, totalQuestions: planned.length };
    }

    // The real guard: the allowance is spent by planning, so it is checked
    // here, before the model is called. A run already charged is never
    // refused — re-planning after a failed attempt costs the user nothing.
    if (!session.meteredAt) {
      await this.entitlements.assertAllowed(user, 'coach.session');
    }

    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId: user.id },
      select: {
        headline: true,
        summary: true,
        skills: true,
        currentTitle: true,
        parsedResume: true,
      },
    });

    // Prefer a resume attached to this run; otherwise fall back to the last one
    // the user parsed anywhere in the app (onboarding, profile, an earlier run).
    const stored = (profile?.parsedResume ?? {}) as {
      skills?: string[];
      roles?: string[];
      experienceYears?: number;
    };
    const attached = (cfg.resume ?? {}) as {
      skills?: string[];
      projects?: string[];
      experienceYears?: number;
    };
    const resume = {
      skills: attached.skills?.length ? attached.skills : stored.skills,
      projects: attached.projects?.length ? attached.projects : stored.roles,
      experienceYears: attached.experienceYears || stored.experienceYears,
    };

    // Practising for a specific job: the posting shapes the questions. If the
    // job has since become unavailable, this is ordinary practice for the role.
    const practiceJobId = practiceJobIdFrom(cfg);
    const jobPosting = practiceJobId ? await this.postingFor(user, practiceJobId) : null;

    const { greeting: generated, questions } = await this.ai.generateCoachQuestions({
      role: String(cfg.role ?? profile?.currentTitle ?? 'the role'),
      experience: String(cfg.experience ?? 'mid'),
      type: String(cfg.type ?? 'mixed'),
      difficulty: Number(cfg.difficulty ?? 2),
      questionCount: Math.min(Number(cfg.questionCount ?? 6), 12),
      focusSkills: Array.isArray(cfg.focusSkills) ? (cfg.focusSkills as string[]) : [],
      resumeSkills: Array.isArray(resume.skills) ? resume.skills : (profile?.skills ?? []),
      profileSnapshot: {
        headline: profile?.headline ?? '',
        summary: (profile?.summary ?? '').slice(0, 600),
        skills: (profile?.skills ?? []).slice(0, 20),
        // Real roles pulled from the uploaded resume, when one was provided.
        recentRoles: (resume.projects ?? []).slice(0, 5),
        yearsOfExperience: resume.experienceYears ?? undefined,
      },
      jobPosting: jobPosting ?? undefined,
    });

    // Give each question a stable id the client can key answers against.
    const withIds = questions.map((q, i) => ({ ...q, id: `q${i + 1}-${randomUUID().slice(0, 8)}` }));

    /**
     * Counted here — after the model has actually planned the run — and once.
     *
     * Opening setup, or abandoning before any AI work, costs the user nothing;
     * the offline practice engine never calls this at all. `meteredAt` makes a
     * retried or resumed plan free, and the conditional update makes that hold
     * even if two plan calls for the same run land together: only the one that
     * flips it from null records a use. Employer screenings returned earlier and
     * are never counted — the employer chose to run them.
     */
    const claimed = await this.prisma.interviewCoachSession.updateMany({
      where: { id, meteredAt: null },
      data: {
        questions: withIds as unknown as Prisma.InputJsonValue,
        meteredAt: new Date(),
      },
    });
    if (claimed.count === 1) {
      await this.entitlements.record(user.id, 'coach.session');
    } else {
      // Already charged: just keep the latest plan.
      await this.prisma.interviewCoachSession.update({
        where: { id },
        data: { questions: withIds as unknown as Prisma.InputJsonValue },
      });
    }

    const greeting = addressGreeting(generated, callNameFrom(cfg));
    return { greeting, questions: withIds, totalQuestions: withIds.length };
  }

  /** Scores one answer with the AI and decides whether to probe deeper. */
  async evaluate(user: User, id: string, dto: EvaluateAnswerDto) {
    const session = await this.owned(user, id);
    const cfg = (session.config ?? {}) as Record<string, unknown>;
    const q = dto.question as { text?: string; competency?: string; expectedSec?: number };

    const result = await this.ai.evaluateCoachAnswer({
      role: String(cfg.role ?? 'the role'),
      question: String(q.text ?? ''),
      competency: String(q.competency ?? 'communication'),
      answer: dto.answer,
      durationSec: dto.durationSec,
      expectedSec: Number(q.expectedSec ?? 120),
    });
    return result;
  }

  /** Builds the end-of-interview report from the real transcript. */
  async report(user: User, id: string, dto: BuildReportDto) {
    const session = await this.owned(user, id);
    const cfg = (session.config ?? {}) as Record<string, unknown>;

    return this.ai.buildCoachReport({
      role: String(cfg.role ?? 'the role'),
      type: String(cfg.type ?? 'mixed'),
      finalScores: dto.finalScores,
      qa: dto.qa.map((x) => ({
        question: String((x as { question?: string }).question ?? ''),
        competency: String((x as { competency?: string }).competency ?? 'communication'),
        answer: String((x as { answer?: string }).answer ?? ''),
      })),
    });
  }

  /* ---------------------------- practice for a job ---------------------------- */

  /**
   * What the "Practice for this interview" button needs to set up a run: the
   * job's title, company, level and skills. Same rule as the run itself —
   * only for a job the caller has applied to.
   */
  async practiceJob(user: User, jobId: string) {
    const job = await this.accessibleJob(user, jobId);
    if (!job) throw new NotFoundException('Job not found');
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      experienceLevel: job.experienceLevel,
      skills: job.skills.slice(0, 10),
      /** Still published. An application keeps practice open after a posting closes. */
      open: LIVE_JOB_STATUSES.includes(job.status),
    };
  }

  private async postingFor(user: User, jobId: string): Promise<JobPostingContext | null> {
    const job = await this.accessibleJob(user, jobId);
    return job ? postingContext(job) : null;
  }

  /**
   * A job someone may practise for: one they have applied to and not
   * withdrawn from. Practice is the step after applying, so a listing alone
   * doesn't qualify. The job's own status doesn't matter — employers often
   * close a posting while still interviewing the people who applied.
   * Anything else is treated as not existing.
   *
   * The company is the employer's company name only; a job with none has no
   * company here rather than the poster's personal name.
   */
  private async accessibleJob(user: User, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        status: true,
        companyName: true,
        experienceLevel: true,
        description: true,
        responsibilities: true,
        requirements: true,
        skills: true,
        postedBy: { select: { employerProfile: { select: { companyName: true } } } },
        applications: {
          where: { applicantId: user.id, status: { not: 'withdrawn' } },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!job || job.applications.length === 0) return null;
    return {
      ...job,
      company: job.companyName || job.postedBy.employerProfile?.companyName || null,
    };
  }

  /* ------------------------------- helpers -------------------------------- */

  /**
   * Owner-scoped lookup. A session belonging to someone else 404s rather than
   * 403s, so the endpoint never confirms that another user's id exists.
   */
  private async owned(user: User, id: string): Promise<SessionRow> {
    const session = await this.prisma.interviewCoachSession.findUnique({ where: { id } });
    if (!session || session.userId !== user.id) throw new NotFoundException('Interview session not found');
    return session;
  }

  private shape(s: SessionRow) {
    return {
      id: s.id,
      config: s.config,
      questions: s.questions,
      answers: s.answers,
      transcript: s.transcript,
      liveScores: s.liveScores,
      questionIndex: s.questionIndex,
      status: s.status,
      durationSec: s.durationSec,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
    };
  }
}
