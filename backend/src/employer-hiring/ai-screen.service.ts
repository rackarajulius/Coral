import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PIPELINE_STAGE_LABELS, stageFromApplicationStatus } from '../common/pipeline-stage';
import { CompanyContextService } from '../company/company-context.service';
import { AiService } from '../services/ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SCREEN_VIDEO_BUCKET, StorageService } from '../storage/storage.service';
import { User } from '../common/types/user.types';
import { InviteScreenDto } from './dto/invite-screen.dto';
import { SubmitScreenDto } from './dto/submit-screen.dto';
import { IntegrityService } from './integrity.service';
import { WebhooksService } from '../integrations/webhooks.service';
import { RequestAccommodationsDto } from './dto/accommodations.dto';
import {
  GenerateJobQuestionsDto, InviteScreenBatchDto, SCREEN_PER_JOB_MAX,
} from './dto/job-screening.dto';

interface VideoAnswer {
  question: string;
  videoPath: string;
}

/** Why a candidate in a batch didn't get invited — surfaced, never swallowed. */
type SkipReason = 'not_an_applicant' | 'already_invited' | 'cap_reached';

@Injectable()
export class AiScreenService {
  private readonly logger = new Logger(AiScreenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
    private readonly integrity: IntegrityService,
    private readonly webhooks: WebhooksService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /**
   * Pushes a finished screening to the employer's ATS integration.
   * Best-effort: a broken endpoint must never fail the candidate's submission.
   */
  private async emitCompleted(screen: {
    id: string; employerId: string; candidateId: string; jobId: string | null;
    role: string | null; mode: string; overallScore: number | null; recommendation: string | null;
    completedAt: Date | null;
  }) {
    await this.webhooks.emit(screen.employerId, 'screening.completed', {
      screeningId: screen.id,
      candidateId: screen.candidateId,
      jobId: screen.jobId,
      role: screen.role,
      mode: screen.mode,
      // Null when unscored (video mode) — receivers must not read that as zero.
      overallScore: screen.overallScore,
      recommendation: screen.recommendation,
      completedAt: screen.completedAt,
    });
  }

  /* --------------------------- job-scoped screens ------------------------ */

  /** The job's shared question set, or an empty set if none exists yet. */
  async getJobQuestions(actor: User, jobId: string) {
    const job = await this.assertJobOwner(actor, jobId);
    return {
      jobId: job.id,
      jobTitle: job.title,
      questions: this.questionsOf(job.screeningQuestions),
      generatedAt: job.screeningGeneratedAt,
      language: job.screeningLanguage,
      applicantCount: await this.prisma.application.count({ where: { jobId: job.id } }),
      screenCount: await this.prisma.aiScreen.count({ where: { jobId: job.id } }),
    };
  }

  /**
   * Writes the one question set every candidate for this job will be asked.
   * Returns the existing set untouched unless `regenerate` is explicitly set —
   * silently replacing it would leave already-scored candidates having sat a
   * different exam from the ones scored next.
   */
  async generateJobQuestions(actor: User, jobId: string, dto: GenerateJobQuestionsDto) {
    const job = await this.assertJobOwner(actor, jobId);
    const existing = this.questionsOf(job.screeningQuestions);
    // A language change is itself a reason to regenerate — the existing set is
    // in the wrong language.
    const language = dto.language || job.screeningLanguage;
    const languageChanged = language !== job.screeningLanguage;
    if (existing.length > 0 && !dto.regenerate && !languageChanged) {
      return this.getJobQuestions(actor, jobId);
    }

    const questions = await this.ai.generateJobScreeningQuestions({
      title: job.title,
      jobDescription: job.description,
      requirements: job.requirements,
      skills: job.skills,
      experienceLevel: job.experienceLevel ?? undefined,
      questionCount: Math.min(Math.max(dto.questionCount ?? 5, 3), 8),
      language,
    });
    if (questions.length === 0) {
      throw new BadRequestException('Could not generate screening questions for this job.');
    }

    await this.prisma.job.update({
      where: { id: job.id },
      data: {
        screeningQuestions: questions as unknown as Prisma.InputJsonValue,
        screeningGeneratedAt: new Date(),
        screeningLanguage: language,
      },
    });
    return this.getJobQuestions(actor, jobId);
  }

  /** Every screen sent for this job — the employer's at-a-glance status column. */
  async listForJob(actor: User, jobId: string) {
    await this.assertJobOwner(actor, jobId);
    const rows = await this.prisma.aiScreen.findMany({
      where: { jobId },
      orderBy: [{ overallScore: 'desc' }, { createdAt: 'desc' }],
      take: SCREEN_PER_JOB_MAX,
    });
    return rows.map((r) => this.forEmployer(r));
  }

  /**
   * Every applicant for a job, ranked by screening result.
   *
   * Includes people who were never invited, haven't started, or declined —
   * a board that only listed finished screens would quietly imply the rest
   * don't exist. Scores are `null` where there is no score; the UI shows "—"
   * rather than a stand-in number.
   */
  async screeningBoard(actor: User, jobId: string) {
    const job = await this.assertJobOwner(actor, jobId);

    const [applications, screens] = await Promise.all([
      this.prisma.application.findMany({
        where: { jobId },
        orderBy: { appliedAt: 'desc' },
        take: 500,
        select: {
          id: true, applicantId: true, status: true, appliedAt: true,
          applicant: {
            select: {
              id: true, displayName: true, firstName: true, lastName: true,
              jobSeekerProfile: { select: { currentTitle: true, currentCompany: true } },
            },
          },
        },
      }),
      this.prisma.aiScreen.findMany({ where: { jobId } }),
    ]);

    const byCandidate = new Map(screens.map((s) => [s.candidateId, s]));

    const rows = applications.map((a) => {
      const s = byCandidate.get(a.applicantId);
      const profile = a.applicant.jobSeekerProfile;
      return {
        applicationId: a.id,
        candidateId: a.applicantId,
        name:
          a.applicant.displayName ||
          [a.applicant.firstName, a.applicant.lastName].filter(Boolean).join(' ') ||
          'Candidate',
        currentTitle: profile?.currentTitle ?? null,
        currentCompany: profile?.currentCompany ?? null,
        applicationStatus: a.status,
        // The shared ladder, derived from status — the old `stage` column
        // said "Application Sent" for everyone.
        stage: PIPELINE_STAGE_LABELS[stageFromApplicationStatus(a.status)],
        appliedAt: a.appliedAt,
        screen: s
          ? {
              id: s.id,
              mode: s.mode,
              status: s.status,
              // Null for video mode and for anything not finished — there is no
              // score to show, and inventing one would be worse than a dash.
              overallScore: s.overallScore,
              recommendation: s.recommendation,
              invitedAt: s.invitedAt,
              completedAt: s.completedAt,
              durationSec: s.durationSec,
              startedLive: s.mode === 'live' ? !!s.consentAt : undefined,
            }
          : null,
      };
    });

    // Actionability order: scored best-first, then finished-but-unscored (video),
    // then awaiting, then never invited, then declined (out of the running).
    const tier = (r: (typeof rows)[number]): number => {
      if (!r.screen) return 3;
      if (r.screen.status === 'declined') return 4;
      if (r.screen.status === 'completed') return r.screen.overallScore == null ? 1 : 0;
      return 2;
    };
    rows.sort((a, b) => {
      const ta = tier(a);
      const tb = tier(b);
      if (ta !== tb) return ta - tb;
      if (ta === 0) return (b.screen?.overallScore ?? 0) - (a.screen?.overallScore ?? 0);
      return b.appliedAt.getTime() - a.appliedAt.getTime();
    });

    const scored = rows.filter((r) => r.screen?.overallScore != null);
    return {
      jobId: job.id,
      jobTitle: job.title,
      questions: this.questionsOf(job.screeningQuestions),
      generatedAt: job.screeningGeneratedAt,
      language: job.screeningLanguage,
      rows,
      summary: {
        applicants: rows.length,
        invited: rows.filter((r) => r.screen && r.screen.status === 'invited').length,
        completed: rows.filter((r) => r.screen?.status === 'completed').length,
        declined: rows.filter((r) => r.screen?.status === 'declined').length,
        notInvited: rows.filter((r) => !r.screen).length,
        scored: scored.length,
      },
    };
  }

  /**
   * Invites many of a job's applicants at once, all against the same question
   * set. Candidates who can't be invited are reported back with a reason
   * rather than being dropped — a partial batch must be visible to the caller.
   */
  async inviteBatch(actor: User, jobId: string, dto: InviteScreenBatchDto) {
    const job = await this.assertJobOwner(actor, jobId);

    // The question set is the whole point of batching; make one if absent.
    let questions = this.questionsOf(job.screeningQuestions);
    if (questions.length === 0) {
      questions = this.questionsOf((await this.generateJobQuestions(actor, jobId, {})).questions);
    }
    if (questions.length === 0) {
      throw new BadRequestException('This job has no screening questions yet.');
    }

    const requested = [...new Set(dto.candidateIds)];
    const skipped: { candidateId: string; reason: SkipReason }[] = [];

    // Only real applicants to THIS job — an employer must not be able to screen
    // an arbitrary user by guessing an id.
    const applications = await this.prisma.application.findMany({
      where: { jobId, applicantId: { in: requested } },
      select: { id: true, applicantId: true },
    });
    const applicationFor = new Map(applications.map((a) => [a.applicantId, a.id]));
    for (const id of requested) {
      if (!applicationFor.has(id)) skipped.push({ candidateId: id, reason: 'not_an_applicant' });
    }

    // Don't re-invite someone who already has a live or finished screen here.
    const existing = await this.prisma.aiScreen.findMany({
      where: { jobId, candidateId: { in: [...applicationFor.keys()] }, status: { not: 'declined' } },
      select: { candidateId: true },
    });
    const alreadyInvited = new Set(existing.map((e) => e.candidateId));

    let eligible = [...applicationFor.keys()].filter((id) => {
      if (alreadyInvited.has(id)) {
        skipped.push({ candidateId: id, reason: 'already_invited' });
        return false;
      }
      return true;
    });

    // Hard ceiling per job: a batch invite spends AI budget per candidate.
    const sentSoFar = await this.prisma.aiScreen.count({ where: { jobId } });
    const room = Math.max(0, SCREEN_PER_JOB_MAX - sentSoFar);
    if (eligible.length > room) {
      for (const id of eligible.slice(room)) skipped.push({ candidateId: id, reason: 'cap_reached' });
      eligible = eligible.slice(0, room);
    }

    const mode = dto.mode === 'video' || dto.mode === 'live' ? dto.mode : 'text';
    const created = eligible.length
      ? await this.prisma.$transaction(
          eligible.map((candidateId) =>
            this.prisma.aiScreen.create({
              data: {
                employerId: actor.id,
                candidateId,
                jobId,
                applicationId: applicationFor.get(candidateId) ?? null,
                role: job.title,
                jobDescription: job.description,
                mode,
                // Snapshot the questions: a later regenerate must not rewrite
                // what this candidate was actually asked.
                questions: questions as unknown as Prisma.InputJsonValue,
                status: 'invited',
              },
            }),
          ),
        )
      : [];

    if (created.length > 0) {
      const company = await this.employerCompany(actor.id);
      const kind = { text: 'AI', video: 'video', live: 'AI interview' }[mode] ?? 'AI';
      const action = {
        text: 'take it',
        video: 'record your answers',
        live: 'talk it through with our AI interviewer',
      }[mode] ?? 'take it';
      // Best-effort: a failed notification must not undo a created screen.
      const results = await Promise.allSettled(
        created.map((screen) =>
          this.notifications.create({
            userId: screen.candidateId,
            type: 'ai_screen',
            title: `${company} invited you to a quick ${kind} screening`,
            message: `${questions.length} short questions for the ${job.title} role — ${action} whenever you're ready.`,
            link: `/ai-screen/${screen.id}`,
          }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) this.logger.warn(`${failed}/${created.length} screening notifications failed to send`);
    }

    return {
      invited: created.map((s) => this.forEmployer(s)),
      skipped,
      questionCount: questions.length,
      remaining: Math.max(0, SCREEN_PER_JOB_MAX - sentSoFar - created.length),
    };
  }

  /* ------------------------------ employer ------------------------------- */

  /** Generates screening questions and invites the candidate to take it. */
  async invite(employer: User, dto: InviteScreenDto) {
    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId: dto.candidateId },
      include: { experiences: { orderBy: { startDate: 'desc' }, take: 5 } },
    });
    if (!profile) throw new NotFoundException('Candidate not found');

    const role = dto.role?.trim() || profile.currentTitle || profile.headline || 'the role';
    const snapshot = {
      headline: profile.headline ?? '',
      summary: profile.summary ?? '',
      skills: (profile.skills ?? []).slice(0, 20),
      experience: profile.experiences.map((e) => `${e.title} @ ${e.company}`),
    };

    const plan = await this.ai.generateInterviewPlan({
      targetRole: role,
      jobDescription: dto.jobDescription,
      questionCount: Math.min(Math.max(dto.questionCount ?? 5, 3), 8),
      profileSnapshot: snapshot,
    });
    const questions = plan.questions.map((q) => q.question).filter(Boolean).slice(0, 8);
    if (questions.length === 0) throw new BadRequestException('Could not generate screening questions.');

    const mode = dto.mode === 'video' ? 'video' : 'text';
    const screen = await this.prisma.aiScreen.create({
      data: {
        employerId: employer.id,
        candidateId: dto.candidateId,
        role: dto.role ?? role,
        jobDescription: dto.jobDescription ?? null,
        mode,
        questions,
        status: 'invited',
      },
    });

    const company = await this.employerCompany(employer.id);
    await this.notifications.create({
      userId: dto.candidateId,
      type: 'ai_screen',
      title: `${company} invited you to a quick ${mode === 'video' ? 'video' : 'AI'} screening`,
      message: `${questions.length} short questions for the ${role} role — ${mode === 'video' ? 'record your answers' : 'take it'} whenever you're ready.`,
      link: `/ai-screen/${screen.id}`,
    });

    return this.forEmployer(screen);
  }

  async listForEmployer(employer: User, candidateId?: string) {
    return this.prisma.aiScreen
      .findMany({
        // The company's screens — a colleague reviewing candidates needs the
        // same list, not an empty one.
        where: {
          employerId: { in: await this.companyContext.memberUserIds(employer.id) },
          ...(candidateId ? { candidateId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      .then((rows) => rows.map((r) => this.forEmployer(r)));
  }

  async getForEmployer(employer: User, id: string) {
    const screen = await this.prisma.aiScreen.findFirst({
      where: { id, employerId: { in: await this.companyContext.memberUserIds(employer.id) } },
    });
    if (!screen) throw new NotFoundException('Screening not found');
    // Observations only, and only on the detail view — never on the ranked
    // board, where a flag beside a name would function as a verdict.
    const integrity = await this.integrity.notesFor(screen.id);
    // The employer sees WHAT was requested so they can honour it. There is
    // nothing here about why, because we never collected it.
    const base = {
      ...this.forEmployer(screen, true),
      integrity,
      accommodations: this.accommodationsOf(screen.accommodations),
    };

    // Video mode: mint short-lived signed URLs so the employer can watch the answers.
    if (screen.mode === 'video' && screen.status === 'completed' && Array.isArray(screen.answers)) {
      const answers = screen.answers as unknown as VideoAnswer[];
      const videoAnswers = await Promise.all(
        answers.map(async (a) => ({
          question: a.question,
          videoUrl: a.videoPath
            ? await this.storage.createSignedUrl(a.videoPath, SCREEN_VIDEO_BUCKET, 3600).catch(() => '')
            : '',
        })),
      );
      return { ...base, videoAnswers };
    }
    return base;
  }

  /* --------------------------- accommodations ---------------------------- */

  /**
   * Records what the candidate needs to take this screening on equal terms.
   *
   * Never blocks and never asks why. Requesting a human interviewer notifies
   * the employer and is expected to be honoured — an AI-only process with no
   * alternative format is the thing accommodation law exists to prevent.
   */
  async requestAccommodations(candidate: User, id: string, dto: RequestAccommodationsDto) {
    const screen = await this.ownedByCandidate(candidate, id);
    if (screen.status !== 'invited') {
      throw new BadRequestException('This screening is already finished.');
    }

    const record = {
      needs: [...new Set(dto.needs)],
      note: dto.note?.trim() || null,
      requestedAt: new Date().toISOString(),
      status: 'requested' as const,
      acknowledgedAt: null as string | null,
    };

    const updated = await this.prisma.aiScreen.update({
      where: { id: screen.id },
      data: { accommodations: record as unknown as Prisma.InputJsonValue },
    });

    const name =
      candidate.displayName || [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'A candidate';
    const wantsHuman = record.needs.includes('human_interviewer');
    await this.notifications
      .create({
        userId: screen.employerId,
        type: 'ai_screen',
        title: wantsHuman
          ? `${name} asked to be interviewed by a person`
          : `${name} requested adjustments for their screening`,
        message: wantsHuman
          ? `They've asked for a human interviewer instead of the AI for ${screen.role ?? 'this role'}. Arrange one and reach out directly.`
          : `Adjustments requested for ${screen.role ?? 'this role'} — open the screening to see what they need.`,
        link: '/employers/candidates',
      })
      .catch(() => undefined);

    return this.accommodationsOf(updated.accommodations);
  }

  /** Employer confirms they've seen the request. Visible to the candidate. */
  async acknowledgeAccommodations(employer: User, id: string) {
    const screen = await this.prisma.aiScreen.findFirst({
      where: { id, employerId: { in: await this.companyContext.memberUserIds(employer.id) } },
    });
    if (!screen) throw new NotFoundException('Screening not found');

    const current = this.accommodationsOf(screen.accommodations);
    if (!current) throw new BadRequestException('No adjustments were requested for this screening.');

    const updated = await this.prisma.aiScreen.update({
      where: { id: screen.id },
      data: {
        accommodations: {
          ...current,
          status: 'acknowledged',
          acknowledgedAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await this.notifications
      .create({
        userId: screen.candidateId,
        type: 'ai_screen',
        title: 'Your requested adjustments were confirmed',
        message: `${await this.employerCompany(screen.employerId)} has seen your request for ${screen.role ?? 'this role'}.`,
        link: `/ai-screen/${screen.id}`,
      })
      .catch(() => undefined);

    return this.accommodationsOf(updated.accommodations);
  }

  /** Normalises the stored blob; null when nothing was requested. */
  private accommodationsOf(value: Prisma.JsonValue | null): {
    needs: string[];
    note: string | null;
    requestedAt: string;
    status: string;
    acknowledgedAt: string | null;
  } | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;
    const needs = Array.isArray(v.needs) ? v.needs.filter((n): n is string => typeof n === 'string') : [];
    if (needs.length === 0) return null;
    return {
      needs,
      note: typeof v.note === 'string' ? v.note : null,
      requestedAt: String(v.requestedAt ?? ''),
      status: String(v.status ?? 'requested'),
      acknowledgedAt: typeof v.acknowledgedAt === 'string' ? v.acknowledgedAt : null,
    };
  }

  /* ---------------------------- live screening --------------------------- */

  /**
   * Records the candidate's acceptance of the AI-interview notice. Separate
   * from starting: consent has to be a deliberate act, and declining after
   * reading it must remain possible.
   */
  async consentToLive(candidate: User, id: string) {
    const screen = await this.ownedByCandidate(candidate, id);
    if (screen.mode !== 'live') throw new BadRequestException('This screening is not a live interview.');
    if (screen.status !== 'invited') throw new BadRequestException('This screening is already finished.');
    if (screen.consentAt) return { consentAt: screen.consentAt };

    const updated = await this.prisma.aiScreen.update({
      where: { id: screen.id },
      data: { consentAt: new Date() },
    });
    return { consentAt: updated.consentAt };
  }

  /**
   * Opens the live run: an interview-coach session bound to this screening,
   * seeded with the job's fixed questions so every candidate is asked the same
   * things. Returns the existing session if one was already started — one run
   * per screening, so a candidate can't retake for a better score.
   */
  async startLive(candidate: User, id: string) {
    const screen = await this.ownedByCandidate(candidate, id);
    if (screen.mode !== 'live') throw new BadRequestException('This screening is not a live interview.');
    if (screen.status !== 'invited') throw new BadRequestException('This screening is already finished.');
    if (!screen.consentAt) throw new BadRequestException('Please accept the interview notice before starting.');

    const existing = await this.prisma.interviewCoachSession.findUnique({ where: { screenId: screen.id } });
    if (existing) {
      if (existing.status !== 'active') {
        throw new BadRequestException('You have already taken this interview.');
      }
      return { sessionId: existing.id, config: existing.config, resumed: true };
    }

    const questions = this.questionsOf(screen.questions);
    if (questions.length === 0) throw new BadRequestException('This screening has no questions.');

    const company = await this.employerCompany(screen.employerId);
    // Requested adjustments have to change the interview, not just be recorded.
    const accommodations = this.accommodationsOf(screen.accommodations);
    const needs = accommodations?.needs ?? [];
    const config = {
      role: screen.role ?? 'the role',
      // A screening is not a practice run: fixed set, no coaching, scores hidden.
      screenMode: true,
      /** Longer silence before an answer is treated as finished. */
      extraTime: needs.includes('extra_time'),
      /** Start in typing mode rather than making them discover the fallback. */
      startTyped: needs.includes('typed_answers'),
      company,
      experience: 'mid',
      type: 'mixed',
      difficulty: 2,
      adaptive: true,
      // Drives speech recognition and the interviewer's voice, so it has to
      // match the language the questions were written in.
      language: await this.screenLanguage(screen.jobId),
      speechRate: 1,
      durationMin: Math.max(10, questions.length * 3),
      questionCount: questions.length,
      focusSkills: [],
    };

    // One active run at a time, same rule the coach uses.
    await this.prisma.interviewCoachSession.updateMany({
      where: { userId: candidate.id, status: 'active' },
      data: { status: 'abandoned' },
    });

    const session = await this.prisma.interviewCoachSession.create({
      data: {
        userId: candidate.id,
        screenId: screen.id,
        config: config as unknown as Prisma.InputJsonValue,
        questions: this.seedQuestions(questions) as unknown as Prisma.InputJsonValue,
      },
    });
    return { sessionId: session.id, config: session.config, resumed: false };
  }

  /**
   * Finalises a live screening: turns the run's transcript into the employer
   * scorecard and notifies them. Idempotent — a retry after a dropped
   * connection returns the existing result instead of re-billing the AI.
   */
  async finishLive(candidate: User, id: string) {
    const screen = await this.ownedByCandidate(candidate, id);
    if (screen.mode !== 'live') throw new BadRequestException('This screening is not a live interview.');
    if (screen.status === 'completed') return this.forCandidate(screen, undefined);
    if (screen.status !== 'invited' || !screen.consentAt) throw new BadRequestException('This interview cannot be submitted.');

    const session = await this.prisma.interviewCoachSession.findUnique({ where: { screenId: screen.id } });
    if (!session) throw new BadRequestException('This interview has not been started.');

    const qa = this.transcriptToQa(session.answers);
    const questions = this.questionsOf(screen.questions);
    if (!questions.length || qa.length !== questions.length || qa.some((entry, i) => entry.question !== questions[i])) {
      throw new BadRequestException('Record an answer to every assigned question before submitting.');
    }

    const evaluation = await this.ai.evaluateScreen({
      role: screen.role ?? 'the role',
      jobDescription: screen.jobDescription ?? undefined,
      qa,
      // Spoken answers are ASR output — the prompt must not mark down speech
      // artefacts as if they were the candidate's writing.
      medium: 'spoken',
      language: await this.screenLanguage(screen.jobId),
    });

    const committed = await this.prisma.aiScreen.updateMany({
      where: { id: screen.id, status: 'invited' },
      data: {
        answers: qa as unknown as Prisma.InputJsonValue,
        evaluation: evaluation as unknown as Prisma.InputJsonValue,
        overallScore: evaluation.overallScore,
        recommendation: evaluation.recommendation,
        durationSec: session.durationSec,
        status: 'completed',
        completedAt: new Date(),
      },
    });
    if (!committed.count) throw new BadRequestException('This screening is no longer awaiting submission.');
    const updated = await this.prisma.aiScreen.findUniqueOrThrow({ where: { id: screen.id } });

    const name =
      candidate.displayName || [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'A candidate';
    await this.notifications
      .create({
        userId: screen.employerId,
        type: 'ai_screen',
        title: `${name} completed the AI interview`,
        message: `Overall score ${evaluation.overallScore}/100 · ${this.recLabel(evaluation.recommendation)}`,
        link: '/employers/candidates',
      })
      .catch(() => undefined);

    await this.emitCompleted(updated);
    return this.forCandidate(updated, undefined);
  }

  /**
   * The candidate's own coaching feedback from their live screening — the same
   * transcript the employer's scorecard came from, read for a different reader.
   * Everyone who finishes gets this, decision or not.
   *
   * Two deliberate redactions:
   *
   * - No overall score. The coach's number and the employer's number are
   *   different judgements of the same interview; showing the coach's here
   *   would read as "the employer scored me 68" and be wrong.
   * - No model answers. Every candidate in a round gets the SAME questions, so
   *   handing out improved answers to those exact questions is an answer key
   *   for a round that is very likely still open.
   */
  async liveFeedback(candidate: User, id: string) {
    const screen = await this.ownedByCandidate(candidate, id);
    if (screen.mode !== 'live') throw new BadRequestException('This screening is not a live interview.');

    const session = await this.prisma.interviewCoachSession.findUnique({
      where: { screenId: screen.id },
      select: { id: true, durationSec: true },
    });
    if (!session) return { available: false as const, reason: 'not_started' as const };

    const stored = await this.prisma.interviewCoachReport.findUnique({
      where: { sessionId: session.id },
      select: { readiness: true, report: true },
    });
    if (!stored) return { available: false as const, reason: 'not_ready' as const };

    const report = (stored.report ?? {}) as {
      competencies?: { id: string; score: number; insight: string }[];
      strengths?: string[];
      weaknesses?: string[];
      repeatedMistakes?: string[];
      focusAreas?: string[];
      responseDurations?: { label: string; sec: number; expected: number }[];
    };

    return {
      available: true as const,
      readiness: stored.readiness,
      competencies: (report.competencies ?? []).map((c) => ({
        id: c.id,
        score: c.score,
        insight: c.insight,
      })),
      strengths: report.strengths ?? [],
      weaknesses: report.weaknesses ?? [],
      repeatedMistakes: report.repeatedMistakes ?? [],
      focusAreas: report.focusAreas ?? [],
      responseDurations: report.responseDurations ?? [],
      durationSec: session.durationSec,
    };
  }

  /** Answers recorded by the coach session → the flat Q&A the scorer wants. */
  private transcriptToQa(answers: Prisma.JsonValue): { question: string; answer: string }[] {
    if (!Array.isArray(answers)) return [];
    return answers
      .map((a) => {
        const rec = (a ?? {}) as { question?: { text?: string }; transcript?: string };
        return { question: String(rec.question?.text ?? ''), answer: String(rec.transcript ?? '').trim() };
      })
      .filter((x) => x.question && x.answer);
  }

  /** Job questions → the Question shape the coach session machinery expects. */
  private seedQuestions(questions: string[]) {
    // Rotated rather than AI-assigned: every candidate must get identical
    // metadata, and a real competency label would need a judgement call the
    // question text alone doesn't support.
    const competencies = ['communication', 'technicalDepth', 'problemSolving', 'structure', 'confidence'];
    return questions.map((text, i) => ({
      id: `sq${i + 1}-${randomUUID().slice(0, 8)}`,
      text,
      competency: competencies[i % competencies.length],
      keywords: [],
      expectedSec: 120,
    }));
  }

  /** Screen lookup scoped to the candidate it was sent to. */
  private async ownedByCandidate(candidate: User, id: string) {
    const screen = await this.prisma.aiScreen.findFirst({ where: { id, candidateId: candidate.id } });
    if (!screen) throw new NotFoundException('Screening not found');
    return screen;
  }

  /* ------------------------------ candidate ------------------------------ */

  async listForCandidate(candidate: User) {
    const screens = await this.prisma.aiScreen.findMany({
      where: { candidateId: candidate.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    if (screens.length === 0) return [];
    const companies = await this.companiesFor(screens.map((s) => s.employerId));
    return screens.map((s) => this.forCandidate(s, companies.get(s.employerId)));
  }

  async getForCandidate(candidate: User, id: string) {
    const screen = await this.prisma.aiScreen.findFirst({ where: { id, candidateId: candidate.id } });
    if (!screen) throw new NotFoundException('Screening not found');
    const companies = await this.companiesFor([screen.employerId]);
    return this.forCandidate(screen, companies.get(screen.employerId));
  }

  /** Candidate uploads a recorded video answer for one question (video mode). */
  async uploadVideo(candidate: User, id: string, index: number, file: Express.Multer.File) {
    const screen = await this.prisma.aiScreen.findFirst({ where: { id, candidateId: candidate.id } });
    if (!screen) throw new NotFoundException('Screening not found');
    if (screen.mode !== 'video') throw new BadRequestException('This screening does not accept video answers.');
    if (screen.status !== 'invited') throw new BadRequestException('This screening has already been submitted.');

    const questions = (screen.questions as string[]) ?? [];
    if (!Number.isInteger(index) || index < 0 || index >= questions.length) {
      throw new BadRequestException('Invalid question index.');
    }
    if (!file?.buffer?.length) throw new BadRequestException('No video file received.');
    if (!file.mimetype?.startsWith('video/')) throw new BadRequestException('Only video files are accepted.');

    const ext = file.mimetype.includes('mp4') ? 'mp4' : file.mimetype.includes('quicktime') ? 'mov' : 'webm';
    const path = `screens/${screen.id}/${index}-${randomUUID()}.${ext}`;
    await this.storage.uploadPrivateFile(path, file.buffer, file.mimetype, SCREEN_VIDEO_BUCKET);

    const answers: VideoAnswer[] = Array.isArray(screen.answers)
      ? (screen.answers as unknown as VideoAnswer[])
      : questions.map((q) => ({ question: q, videoPath: '' }));
    const prev = answers[index]?.videoPath;
    if (prev) await this.storage.deletePublicFile(prev, SCREEN_VIDEO_BUCKET); // best-effort replace
    answers[index] = { question: questions[index], videoPath: path };

    await this.prisma.aiScreen.update({
      where: { id: screen.id },
      data: { answers: answers as unknown as Prisma.InputJsonValue },
    });

    return { index, uploaded: answers.filter((a) => a.videoPath).length, total: questions.length };
  }

  /** Candidate submits answers → (text) AI evaluates or (video) queued for review → employer notified. */
  async submit(candidate: User, id: string, dto: SubmitScreenDto) {
    const screen = await this.prisma.aiScreen.findFirst({ where: { id, candidateId: candidate.id } });
    if (!screen) throw new NotFoundException('Screening not found');
    if (screen.status !== 'invited') throw new BadRequestException('This screening has already been submitted.');

    const questions = (screen.questions as string[]) ?? [];

    // Video mode: answers were uploaded per-question; just finalize (no AI scoring).
    if (screen.mode === 'video') {
      const answers: VideoAnswer[] = Array.isArray(screen.answers)
        ? (screen.answers as unknown as VideoAnswer[])
        : [];
      if (questions.length === 0 || !questions.every((_, i) => answers[i]?.videoPath)) {
        throw new BadRequestException('Please record an answer for every question before submitting.');
      }
      const updated = await this.prisma.aiScreen.update({
        where: { id: screen.id },
        data: { status: 'completed', completedAt: new Date() },
      });
      const name =
        candidate.displayName || [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'A candidate';
      await this.notifications.create({
        userId: screen.employerId,
        type: 'ai_screen',
        title: `${name} completed the video screening`,
        message: `${questions.length} video answer${questions.length > 1 ? 's' : ''} ready to review${screen.role ? ` · ${screen.role}` : ''}`,
        link: '/employers/candidates',
      });
      await this.emitCompleted(updated);
      return this.forCandidate(updated, undefined);
    }

    if (screen.mode !== 'text') throw new BadRequestException('Complete live interviews through the live interview flow.');
    if (!questions.length || !dto.answers || dto.answers.length !== questions.length) {
      throw new BadRequestException('Please provide exactly one answer for every question.');
    }
    const qa = questions.map((question, i) => ({
      question,
      answer: (dto.answers?.[i] ?? '').trim(),
    }));
    if (qa.some((x) => x.answer.length === 0)) {
      throw new BadRequestException('Please answer every question before submitting.');
    }

    // Integrity observations are stored alongside, never mixed into the score.
    if (dto.integrity) await this.integrity.record(screen.id, dto.integrity);

    const evaluation = await this.ai.evaluateScreen({
      role: screen.role ?? 'the role',
      jobDescription: screen.jobDescription ?? undefined,
      qa,
      language: await this.screenLanguage(screen.jobId),
    });

    const committed = await this.prisma.aiScreen.updateMany({
      where: { id: screen.id, status: 'invited' },
      data: {
        answers: qa as unknown as Prisma.InputJsonValue,
        evaluation: evaluation as unknown as Prisma.InputJsonValue,
        overallScore: evaluation.overallScore,
        recommendation: evaluation.recommendation,
        status: 'completed',
        completedAt: new Date(),
      },
    });
    if (!committed.count) throw new BadRequestException('This screening is no longer awaiting submission.');
    const updated = await this.prisma.aiScreen.findUniqueOrThrow({ where: { id: screen.id } });

    const candidateName =
      candidate.displayName || [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'A candidate';
    await this.notifications.create({
      userId: screen.employerId,
      type: 'ai_screen',
      title: `${candidateName} completed the AI screening`,
      message: `Overall score ${evaluation.overallScore}/100 · ${this.recLabel(evaluation.recommendation)}`,
      link: '/employers/candidates',
    });

    await this.emitCompleted(updated);
    return this.forCandidate(updated, undefined);
  }

  async decline(candidate: User, id: string) {
    const screen = await this.prisma.aiScreen.findFirst({ where: { id, candidateId: candidate.id } });
    if (!screen) throw new NotFoundException('Screening not found');
    if (screen.status !== 'invited') throw new ForbiddenException('This screening can no longer be declined.');
    const claim = await this.prisma.aiScreen.updateMany({ where: { id: screen.id, status: 'invited' }, data: { status: 'declined' } });
    if (!claim.count) throw new ForbiddenException('This screening can no longer be declined.');
    const updated = await this.prisma.aiScreen.findUniqueOrThrow({ where: { id: screen.id } });

    const company = await this.employerCompany(screen.employerId);
    await this.notifications.create({
      userId: screen.employerId,
      type: 'ai_screen',
      title: 'A candidate declined the AI screening',
      message: screen.role ?? '',
      link: '/employers/candidates',
    });
    void company;
    return this.forCandidate(updated, undefined);
  }

  /* ------------------------------ shaping -------------------------------- */

  /** Employer view — includes the scorecard once completed. */
  private forEmployer(s: {
    id: string;
    candidateId: string;
    jobId: string | null;
    role: string | null;
    status: string;
    mode: string;
    overallScore: number | null;
    recommendation: string | null;
    evaluation: Prisma.JsonValue;
    createdAt: Date;
    completedAt: Date | null;
    questions: Prisma.JsonValue;
  }, full = false) {
    return {
      id: s.id,
      candidateId: s.candidateId,
      jobId: s.jobId,
      role: s.role,
      status: s.status,
      mode: s.mode,
      overallScore: s.overallScore,
      recommendation: s.recommendation,
      questionCount: Array.isArray(s.questions) ? s.questions.length : 0,
      createdAt: s.createdAt,
      completedAt: s.completedAt,
      evaluation: full ? s.evaluation : undefined,
    };
  }

  /** Candidate view — questions + status, NEVER the recruiter scorecard. */
  private forCandidate(
    s: {
      id: string; jobId?: string | null; role: string | null; status: string; mode: string; consentAt?: Date | null;
      accommodations?: Prisma.JsonValue | null;
      questions: Prisma.JsonValue; answers: Prisma.JsonValue; createdAt: Date; completedAt: Date | null;
    },
    company: string | undefined,
  ) {
    const questions = (s.questions as string[]) ?? [];
    const answers = Array.isArray(s.answers) ? (s.answers as unknown as VideoAnswer[]) : [];
    return {
      id: s.id,
      /** The job applied to, when the screening came from one — lets the job page offer it. */
      jobId: s.jobId ?? null,
      role: s.role,
      company: company ?? 'An employer',
      status: s.status, // invited | completed | declined — no scores exposed
      mode: s.mode,
      /** Live mode: when they accepted the notice (null = not yet). */
      consentAt: s.consentAt ?? null,
      /** What they asked for, so the page can show it back to them. */
      accommodations: this.accommodationsOf(s.accommodations ?? null),
      questions,
      // video mode: which questions already have a recorded clip (so the UI can resume)
      videoDone: s.mode === 'video' ? questions.map((_, i) => !!answers[i]?.videoPath) : undefined,
      createdAt: s.createdAt,
      completedAt: s.completedAt,
    };
  }

  /**
   * The language a screening was conducted in. Read from the job so it always
   * matches the questions the candidate was actually asked; screens with no
   * job (sourced candidates) fall back to English.
   */
  private async screenLanguage(jobId: string | null): Promise<string> {
    if (!jobId) return 'en-US';
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { screeningLanguage: true },
    });
    return job?.screeningLanguage || 'en-US';
  }

  /** Normalises a stored questions blob to a clean string[]. */
  private questionsOf(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      : [];
  }

  /**
   * The job, if this actor may screen for it. Mirrors the applications rule:
   * the poster owns it, admins may act on any.
   */
  private async assertJobOwner(actor: User, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true, title: true, description: true, requirements: true, skills: true,
        experienceLevel: true, postedById: true,
        screeningQuestions: true, screeningGeneratedAt: true, screeningLanguage: true,
      },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (actor.role !== UserRole.ADMIN && job.postedById !== actor.id) {
      throw new ForbiddenException('You can only screen candidates for your own jobs');
    }
    return job;
  }

  private recLabel(r: string): string {
    return { strong_yes: 'Strong yes', yes: 'Yes', maybe: 'Maybe', no: 'No' }[r] ?? r;
  }

  private async companiesFor(employerIds: string[]): Promise<Map<string, string>> {
    const profiles = await this.prisma.employerProfile.findMany({
      where: { userId: { in: [...new Set(employerIds)] } },
      select: { userId: true, companyName: true },
    });
    return new Map(profiles.map((p) => [p.userId, p.companyName?.trim() || 'An employer']));
  }

  private async employerCompany(userId: string): Promise<string> {
    const emp = await this.prisma.employerProfile.findUnique({ where: { userId }, select: { companyName: true } });
    return emp?.companyName?.trim() || 'An employer';
  }
}
