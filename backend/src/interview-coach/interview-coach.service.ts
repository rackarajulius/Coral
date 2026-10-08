import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';
import { AiService } from '../services/ai/ai.service';
import { SeekerEntitlementsService } from '../seeker-entitlements/seeker-entitlements.service';
import {
  EvaluateAnswerDto, StartSessionDto,
} from './dto/interview-coach.dto';
import { buildCoachSessionReport, COACH_SCORE_KEYS, type CoachAnswer, type CoachQuestion, type CoachScores } from './report';
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
      where: { userId: user.id, status: 'active', screenId: null },
      data: { status: 'abandoned' },
    });

    const session = await this.prisma.interviewCoachSession.create({
      data: {
        userId: user.id,
        config: config as Prisma.InputJsonValue,
        questions: [] as Prisma.InputJsonValue,
      },
    });
    return this.shape(session);
  }

  /** The user's most recent still-active session, for crash/refresh recovery. */
  async getActive(user: User) {
    const session = await this.prisma.interviewCoachSession.findFirst({
      where: { userId: user.id, status: 'active', screenId: null },
      orderBy: { startedAt: 'desc' },
    });
    return session ? this.shape(session) : null;
  }

  async getOne(user: User, id: string) {
    const session = await this.owned(user, id);
    const report = await this.prisma.interviewCoachReport.findUnique({ where: { sessionId: id } });
    return { ...this.shape(session), report: report?.report ?? null };
  }

  /** Completes a run only after its server-generated report has been saved. */
  async complete(user: User, id: string) {
    const session = await this.owned(user, id);
    const savedReport = await this.prisma.interviewCoachReport.findUnique({ where: { sessionId: id } });
    if (!savedReport) throw new BadRequestException('Generate the interview report before completing the session.');
    if (session.status === 'abandoned') throw new BadRequestException('This interview was abandoned.');
    const updated = session.status === 'completed' ? session : await this.prisma.interviewCoachSession.update({
      where: { id }, data: { status: 'completed', completedAt: new Date() },
    });
    return { ...this.shape(updated), report: savedReport.report };
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
    if (session.status !== 'active') throw new BadRequestException('This interview has already finished.');
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
      // Another request won the claim. Return its stored plan so question IDs
      // never change under answers already in progress.
      const winner = await this.owned(user, id);
      const stored = asArray(winner.questions);
      if (stored.length === 0) throw new ConflictException('Interview planning is still in progress. Please retry.');
      return {
        greeting: addressGreeting("I'm Nova, your interview coach today. Let's pick up where we left off.", callNameFrom(cfg)),
        questions: stored,
        totalQuestions: stored.length,
      };
    }

    const greeting = addressGreeting(generated, callNameFrom(cfg));
    return { greeting, questions: withIds, totalQuestions: withIds.length };
  }

  /** Scores one answer with the AI and decides whether to probe deeper. */
  async evaluate(user: User, id: string, dto: EvaluateAnswerDto) {
    const session = await this.owned(user, id);
    const previousAnswers = asArray(session.answers) as CoachAnswer[];
    const previous = previousAnswers.find((a) => a.questionId === dto.questionId);
    if (previous) {
      if (previous.transcript !== dto.answer) throw new ConflictException('This question has already been answered.');
      return previous.evaluation;
    }
    if (session.status !== 'active') throw new BadRequestException('This interview has already finished.');
    const existingReport = await this.prisma.interviewCoachReport.findUnique({ where: { sessionId: id } });
    if (existingReport) throw new BadRequestException('This interview already has a report.');
    const mainQuestions = asArray(session.questions) as CoachQuestion[];
    if (!mainQuestions.length || (!session.screenId && !session.meteredAt)) {
      throw new BadRequestException('Plan the interview before answering.');
    }
    const last = previousAnswers[previousAnswers.length - 1];
    const nextMainIndex = previousAnswers.filter((a) => !a.question.isFollowUp).length;
    const question = last?.evaluation.followUp ?? mainQuestions[nextMainIndex];
    if (!question || question.id !== dto.questionId) {
      throw new BadRequestException('This is not the next interview question.');
    }
    const cfg = (session.config ?? {}) as Record<string, unknown>;
    const result = await this.ai.evaluateCoachAnswer({
      role: String(cfg.role ?? 'the role'),
      question: question.text,
      competency: question.competency,
      answer: dto.answer,
      durationSec: dto.durationSec,
      expectedSec: question.expectedSec,
    });

    // Recheck after the model call: a request retried while its first response
    // was in flight must not append a second copy of the answer.
    const fresh = await this.owned(user, id);
    const freshAnswers = asArray(fresh.answers) as CoachAnswer[];
    const saved = freshAnswers.find((a) => a.questionId === dto.questionId);
    if (saved) {
      if (saved.transcript !== dto.answer) throw new ConflictException('This question has already been answered.');
      return saved.evaluation;
    }
    if (fresh.status !== 'active') throw new BadRequestException('This interview has already finished.');
    const priorScores = this.coachScores(fresh.liveScores);
    const scores = {} as CoachScores;
    const delta: Partial<CoachScores> = {};
    for (const key of COACH_SCORE_KEYS) {
      const next = Math.round(priorScores[key] * 0.6 + result.scores[key] * 0.4);
      scores[key] = next;
      if (next !== priorScores[key]) delta[key] = next - priorScores[key];
    }
    const usedFollowUps = freshAnswers.filter((a) => !!a.evaluation.followUp).length;
    const followUp = !session.screenId && result.followUp && usedFollowUps < Math.ceil(mainQuestions.length / 3)
      ? {
          id: `fu-${question.id}-${usedFollowUps + 1}`,
          text: result.followUp,
          competency: question.competency,
          keywords: question.keywords ?? [],
          expectedSec: Math.round(question.expectedSec * 0.6),
          isFollowUp: true,
          parentId: question.id,
        }
      : undefined;
    const evaluation = {
      scores, delta,
      fillerCount: (dto.answer.match(/\b(?:um+|uh+|erm+|like|you know|basically|actually|sort of|kind of|i mean)\b/gi) ?? []).length,
      wordCount: dto.answer.trim() ? dto.answer.trim().split(/\s+/).length : 0,
      followUp,
    };
    const answer: CoachAnswer = {
      questionId: question.id,
      transcript: dto.answer,
      durationSec: dto.durationSec,
      typed: dto.typed ?? false,
      question,
      evaluation,
      askedAt: new Date().toISOString(),
    };
    const committed = await this.prisma.interviewCoachSession.updateMany({
      where: { id, status: 'active', updatedAt: fresh.updatedAt },
      data: {
        answers: [...freshAnswers, answer] as unknown as Prisma.InputJsonValue,
        transcript: [...asArray(fresh.transcript), { speaker: 'you', text: dto.answer, at: answer.askedAt }] as Prisma.InputJsonValue,
        liveScores: scores as unknown as Prisma.InputJsonValue,
        questionIndex: nextMainIndex + (question.isFollowUp ? 0 : 1),
        durationSec: fresh.durationSec + Math.round(dto.durationSec),
      },
    });
    if (committed.count !== 1) {
      const latest = await this.owned(user, id);
      const retry = (asArray(latest.answers) as CoachAnswer[]).find((a) => a.questionId === dto.questionId);
      if (retry?.transcript === dto.answer) return retry.evaluation;
      throw new ConflictException('This interview changed while the answer was being saved. Please retry.');
    }
    return evaluation;
  }

  /** Builds and stores one authoritative report from persisted answers. */
  async report(user: User, id: string) {
    const session = await this.owned(user, id);
    const existing = await this.prisma.interviewCoachReport.findUnique({ where: { sessionId: id } });
    if (existing) return existing.report;
    if (session.status !== 'active') throw new BadRequestException('This interview has already finished.');
    const answers = asArray(session.answers) as CoachAnswer[];
    if (answers.length === 0) throw new BadRequestException('Answer at least one question before requesting a report.');
    const cfg = (session.config ?? {}) as Record<string, unknown>;
    const scores = this.coachScores(session.liveScores);
    const insights = await this.ai.buildCoachReport({
      role: String(cfg.role ?? 'the role'),
      type: String(cfg.type ?? 'mixed'),
      finalScores: { ...scores },
      qa: answers.map((a) => ({ question: a.question.text, competency: a.question.competency, answer: a.transcript })),
    }).catch(() => ({
      recommendation: '', strengths: [], weaknesses: [], repeatedMistakes: [], focusAreas: [],
      competencyInsights: [], sampleAnswers: [],
    }));
    const latest = await this.owned(user, id);
    if (latest.status !== 'active' || latest.updatedAt.getTime() !== session.updatedAt.getTime()) {
      throw new ConflictException('The interview changed while the report was being prepared. Please retry.');
    }
    const report = buildCoachSessionReport(id, cfg, answers, scores, insights);
    const saved = await this.prisma.interviewCoachReport.upsert({
      where: { sessionId: id },
      create: { sessionId: id, userId: user.id, overallScore: report.overallScore, readiness: report.readiness, report: report as unknown as Prisma.InputJsonValue },
      update: {},
    });
    return saved.report;
  }

  private coachScores(value: Prisma.JsonValue | null): CoachScores {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const scores = {} as CoachScores;
    for (const key of COACH_SCORE_KEYS) {
      const number = source[key];
      scores[key] = typeof number === 'number' && Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 50;
    }
    return scores;
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
