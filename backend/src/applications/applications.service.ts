import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { User } from '../common/types/user.types';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { CompanyAuditService } from '../company/company-audit.service';
import { CandidateWatchersService } from '../company/candidate-watchers.service';
import { PipelineLinkService } from '../company/pipeline-link.service';
import { computeMatchScore } from './match-score';
import { SlackService } from '../integrations/slack.service';
import { LIVE_JOB_STATUSES } from '../jobs/job-lifecycle.service';
import { BulkUpdateApplicationsDto } from './dto/bulk-update-applications.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { ApplicantsQueryDto } from './dto/applicants-query.dto';
import { UpdateApplicationPipelineDto } from './dto/update-application-pipeline.dto';
import {
  ApplicationStatus,
  UpdateApplicationStatusDto,
} from './dto/update-application-status.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { RESUME_BUCKET, StorageService } from '../storage/storage.service';

/** Splits a comma-separated filter parameter, dropping blanks. */
const csv = (value?: string): string[] =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
    private readonly companyContext: CompanyContextService,
    private readonly slack: SlackService,
    private readonly audit: CompanyAuditService,
    private readonly watchers: CandidateWatchersService,
    private readonly pipelineLink: PipelineLinkService,
  ) {}

  async listMyApplications(userId: string, query: ListApplicationsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = this.buildApplicationsWhere({
      applicantId: userId,
      query,
    });

    const [data, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: this.buildApplicationInclude(),
        orderBy: { appliedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  /**
   * All applicants across every job the employer posted — powers the
   * /employers/candidates ATS board. Applicants shared their contact details by
   * applying, so email/phone/resume are legitimately included here.
   */
  async listApplicantsForMyJobs(actor: User, query: ApplicantsQueryDto = {}) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);

    const where: Prisma.ApplicationWhereInput = {
      // Every job the company posted, not only this recruiter's. Scoping to
      // the caller would give a teammate an empty candidate board.
      job: { postedById: { in: await this.companyContext.memberUserIds(actor.id) } },
      // Both arrive comma-separated so multi-select filters stay server-side.
      // Narrowing in the browser would re-introduce the original bug: you would
      // be filtering the current page rather than the whole pipeline.
      ...(csv(query.jobId).length ? { jobId: { in: csv(query.jobId) } } : {}),
      ...(query.status ? { status: query.status } : {}),
      // Rejected applicants are hidden unless asked for, matching what the
      // board used to do in the browser.
      ...(query.includeRejected === 'true' ? {} : { status: { not: 'rejected' } }),
      ...(query.q?.trim()
        ? {
            OR: [
              { applicant: { displayName: { contains: query.q.trim(), mode: 'insensitive' } } },
              { applicant: { firstName: { contains: query.q.trim(), mode: 'insensitive' } } },
              { applicant: { lastName: { contains: query.q.trim(), mode: 'insensitive' } } },
              { applicant: { email: { contains: query.q.trim(), mode: 'insensitive' } } },
              { job: { title: { contains: query.q.trim(), mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    // Sorting by match is the whole reason the score is stored. `nulls: 'last'`
    // keeps jobs with no listed skills — where the score is genuinely unknown —
    // out of the top of a "best first" list.
    const orderBy: Prisma.ApplicationOrderByWithRelationInput[] =
      query.sort === 'match'
        ? [{ matchScore: { sort: 'desc', nulls: 'last' } }, { appliedAt: 'desc' }]
        : [{ appliedAt: 'desc' }];

    const [applications, total] = await Promise.all([
      this.prisma.application.findMany({
      where,
      include: {
        job: { select: { id: true, title: true, skills: true } },
        applicant: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
            jobSeekerProfile: {
              select: {
                currentTitle: true,
                currentCompany: true,
                city: true,
                country: true,
                skills: true,
                summary: true,
                phone: true,
                experiences: {
                  orderBy: { startDate: 'desc' },
                  take: 5,
                  select: { title: true, company: true, startDate: true, endDate: true, current: true },
                },
                educations: {
                  orderBy: { startDate: 'desc' },
                  take: 3,
                  select: { institution: true, degree: true, endDate: true },
                },
              },
            },
          },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
      data: await Promise.all(
        applications.map(async (a) => {
        const p = a.applicant.jobSeekerProfile;
        const jobSkills = (a.job.skills ?? []).map((s) => s.toLowerCase());
        // Stored, so the database could sort and page by it. Recomputed only as
        // a fallback for a row that somehow missed both the backfill and the
        // recompute sweep — showing nothing would look like a zero.
        const matchScore = a.matchScore ?? computeMatchScore(a.job.skills, p?.skills);

        return {
          id: a.id,
          status: a.status,
          appliedAt: a.appliedAt,
          updatedAt: a.updatedAt,
          // A stored resume is private; hand the employer a short-lived signed
          // URL rather than the raw path. Falls back to any legacy link.
          resumeUrl: a.resumePath
            ? await this.storage
                .createSignedUrl(a.resumePath, RESUME_BUCKET, 900)
                .catch(() => a.resumeUrl)
            : a.resumeUrl,
          job: { id: a.job.id, title: a.job.title },
          matchScore,
          matchedSkills: jobSkills.length > 0 ? (p?.skills ?? []).filter((s) => jobSkills.some((js) => s.toLowerCase().includes(js) || js.includes(s.toLowerCase()))) : [],
          applicant: {
            id: a.applicant.id,
            name:
              a.applicant.displayName ||
              [a.applicant.firstName, a.applicant.lastName].filter(Boolean).join(' ') ||
              a.applicant.email,
            email: a.applicant.email,
            phone: p?.phone ?? null,
            currentTitle: p?.currentTitle ?? null,
            currentCompany: p?.currentCompany ?? null,
            location: [p?.city, p?.country].filter(Boolean).join(', '),
            skills: p?.skills ?? [],
            summary: p?.summary ?? null,
            experiences: p?.experiences ?? [],
            educations: p?.educations ?? [],
          },
        };
        }),
      ),
    };
  }

  async listJobApplications(jobId: string, actor: User, query: ListApplicationsQueryDto) {
    await this.assertCanManageApplicationsForJob(jobId, actor);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = this.buildApplicationsWhere({
      jobId,
      query,
    });

    const [data, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: this.buildApplicationInclude(),
        orderBy: { appliedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async getJobPipeline(jobId: string, actor: User, query: ListApplicationsQueryDto) {
    await this.assertCanManageApplicationsForJob(jobId, actor);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const filteredWhere = this.buildApplicationsWhere({
      jobId,
      query,
    });
    const fullJobWhere: Prisma.ApplicationWhereInput = { jobId };

    const [data, filteredTotal, totalForJob, statusBreakdown] = await Promise.all([
      this.prisma.application.findMany({
        where: filteredWhere,
        include: this.buildApplicationInclude(),
        orderBy: [{ updatedAt: 'desc' }, { appliedAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.application.count({ where: filteredWhere }),
      this.prisma.application.count({ where: fullJobWhere }),
      this.prisma.application.groupBy({
        by: ['status'],
        where: fullJobWhere,
        _count: { _all: true },
      }),
    ]);

    const statusCounts = this.buildStatusCounts(statusBreakdown);

    return {
      data,
      meta: {
        page,
        limit,
        total: filteredTotal,
        totalPages: Math.max(Math.ceil(filteredTotal / limit), 1),
      },
      pipeline: {
        totalApplications: totalForJob,
        filteredApplications: filteredTotal,
        byStatus: statusCounts,
        openPipelineCount:
          totalForJob - (statusCounts.hired + statusCounts.rejected + statusCounts.withdrawn),
      },
    };
  }

  async getApplicationById(applicationId: string, actor: User) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: this.buildApplicationInclude(),
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const isApplicant = application.applicantId === actor.id;
    const isAdmin = actor.role === UserRole.ADMIN;
    // Company-wide: without this a teammate sees the application on the board
    // and gets a 403 the moment they open it.
    const isJobOwner =
      application.job.postedById === actor.id ||
      (await this.companyContext.memberUserIds(actor.id)).includes(application.job.postedById);

    if (!isApplicant && !isJobOwner && !isAdmin) {
      throw new ForbiddenException('You do not have access to this application');
    }

    return {
      ...application,
      permissions: {
        canWithdraw: isApplicant || isAdmin,
        canUpdateStatus: isJobOwner || isAdmin,
      },
    };
  }

  async createApplication(userId: string, dto: CreateApplicationDto) {
    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      select: {
        id: true,
        title: true,
        status: true,
        postedById: true,
        maxApplicants: true,
        applicationDeadline: true,
        applicationsCount: true,
        applicationMethod: true,
        skills: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Both vocabularies are live: the admin panel writes 'published', the rest
    // of the app writes 'active'. Checking only one made every admin-created
    // job unappliable.
    if (!LIVE_JOB_STATUSES.includes(job.status)) {
      throw new BadRequestException('Only active jobs can receive applications');
    }

    // The employer routes this job's applications elsewhere, so an on-platform
    // application would never reach them.
    if (job.applicationMethod && job.applicationMethod !== 'internal') {
      throw new BadRequestException(
        job.applicationMethod === 'external'
          ? "This employer accepts applications on their own website."
          : 'This employer accepts applications by email.',
      );
    }

    if (job.postedById === userId) {
      throw new BadRequestException('You cannot apply to a job you posted');
    }

    if (job.applicationDeadline && job.applicationDeadline < new Date()) {
      throw new BadRequestException('This job is no longer accepting applications');
    }

    if (
      job.maxApplicants !== null &&
      job.maxApplicants !== undefined &&
      job.applicationsCount >= job.maxApplicants
    ) {
      throw new BadRequestException('This job has reached the maximum number of applicants');
    }

    const coverLetter = dto.coverLetter?.trim();

    // A resume tailored to this application wins over the profile default.
    // The path must live under the caller's own folder — never trust a client
    // path that could point at someone else's file.
    let resumePath: string | null = null;
    if (dto.resumePath) {
      if (!dto.resumePath.startsWith(`resumes/${userId}/`)) {
        throw new BadRequestException('That resume does not belong to you.');
      }
      resumePath = dto.resumePath;
    } else {
      // Otherwise snapshot whatever they have on file right now, so a later
      // profile change doesn't rewrite what the employer received.
      const seeker = await this.prisma.jobSeekerProfile.findUnique({
        where: { userId },
        select: { resumePath: true },
      });
      resumePath = seeker?.resumePath ?? null;
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const applicantProfile = await tx.jobSeekerProfile.findUnique({
          where: { userId },
          select: { skills: true },
        });

        const application = await tx.application.create({
          data: {
            jobId: dto.jobId,
            applicantId: userId,
            matchScore: computeMatchScore(job.skills, applicantProfile?.skills),
            coverLetter: coverLetter || null,
            resumeUrl: dto.resumeUrl?.trim(),
            resumePath,
            expectedSalary: dto.expectedSalary,
            availabilityDate: this.parseOptionalDate(dto.availabilityDate, 'availabilityDate'),
            status: ApplicationStatus.PENDING,
          },
          include: this.buildApplicationInclude(),
        });

        await tx.job.update({
          where: { id: dto.jobId },
          data: {
            applicationsCount: {
              increment: 1,
            },
          },
        });

        return application;
      });

      /**
       * If this company already sourced this person, the two records become one
       * candidate rather than two cards with two stages. Outside the
       * transaction and not awaited: the application is saved either way, and an
       * unlinked card is a tidiness problem, not a lost application.
       */
      void this.pipelineLink.linkOnApply(created.id, userId, job.postedById);

      // Notify the job owner (fire-and-forget — create() never throws).
      void this.notifications.create({
        userId: job.postedById,
        type: 'application',
        title: 'New application',
        message: `You received a new application for "${job.title}".`,
        link: '/employers/jobs',
      });

      // And the company's Slack channel, if they have one. Posted explicitly
      // rather than by hooking every notification: this funnel also carries
      // candidates' own notifications, and piping those into an employer's
      // channel would leak across the wrong boundary entirely.
      //
      // The applicant is deliberately not named — a Slack channel can include
      // people who hold no seat here, and it is searchable forever.
      void this.companyContext
        .forUser(job.postedById)
        .then((ctx) =>
          ctx
            ? this.slack.notify(ctx.companyId, {
                title: 'New application',
                body: `Someone applied for "${job.title}".`,
                link: '/employers/candidates',
              })
            : null,
        )
        .catch(() => undefined);

      return {
        success: true,
        message: 'Application submitted successfully',
        data: created,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('You have already applied to this job');
      }
      throw error;
    }
  }

  async updateApplicationStatus(
    applicationId: string,
    actor: User,
    dto: UpdateApplicationStatusDto,
  ) {
    return this.updateApplicationPipeline(applicationId, actor, {
      status: dto.status,
      notes: dto.notes,
    });
  }

  async updateApplicationPipeline(
    applicationId: string,
    actor: User,
    dto: UpdateApplicationPipelineDto,
  ) {
    if (dto.status === undefined && dto.notes === undefined) {
      throw new BadRequestException('At least one pipeline field must be provided');
    }

    const existing = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: {
            id: true,
            postedById: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Application not found');
    }

    await this.assertCanManageApplications(existing.job.postedById, actor);

    if (dto.status === ApplicationStatus.WITHDRAWN && actor.role !== UserRole.ADMIN) {
      throw new BadRequestException('Employers cannot mark applications as withdrawn');
    }

    const isTerminalCurrent = this.isTerminalStatus(existing.status);
    if (
      dto.status !== undefined &&
      isTerminalCurrent &&
      actor.role !== UserRole.ADMIN &&
      existing.status !== dto.status
    ) {
      throw new BadRequestException('Terminal applications cannot change status');
    }

    const status = dto.status ?? undefined;
    const notes = dto.notes !== undefined ? this.normalizeNotes(dto.notes) : undefined;

    // The moment the candidate stops waiting, recorded once and never moved.
    // A private note is not a response to them, so only a status change counts.
    const isFirstResponse = existing.firstRespondedAt === null && status !== undefined;

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(isFirstResponse ? { firstRespondedAt: new Date() } : {}),
      },
      include: this.buildApplicationInclude(),
    });

    // Tell the candidate they advanced, and point them at role-specific prep.
    if (status !== undefined && status !== existing.status) {
      void this.notifyStatusChange(applicationId, status);
      /**
       * Keep a linked sourcing record in step, so the sourced board does not go
       * on showing "Contacted" for someone the ATS board has moved to Interview.
       * The two directions are deliberately both here and in ShortlistService:
       * a recruiter moves candidates from whichever board they are looking at.
       */
      void this.pipelineLink.syncSourcedCard(applicationId, status);
    }

    // And tell the colleagues working this candidate. One move is worth a line
    // to them; the bulk path does not do this, because thirty "moved to
    // Rejected" notifications from a morning's triage are how a bell gets muted.
    const moved = status !== undefined && status !== existing.status;
    if (moved) void this.announceMove(actor, updated.applicantId, updated.status);

    // Deliberately no candidate name: this log exports to CSV, so anything
    // written here leaves the app and stops being covered by access checks.
    // The id is enough for anyone with candidate access to resolve it in-app.
    void this.audit.recordFor(actor, {
      category: 'CANDIDATES',
      action: 'Updated a candidate',
      entityType: 'Application',
      entityId: updated.id,
      summary:
        existing.status !== updated.status
          ? `Moved a candidate from ${existing.status} to ${updated.status}`
          : `Updated a candidate's pipeline`,
      before: { status: existing.status },
      after: { status: updated.status },
    });

    return {
      success: true,
      message: 'Application pipeline updated successfully',
      data: {
        ...updated,
        isTerminal: this.isTerminalStatus(updated.status),
      },
    };
  }

  private async announceMove(actor: User, candidateId: string, where: string) {
    const context = await this.companyContext.forUser(actor.id);
    if (!context) return;
    const [who, whom, link] = await Promise.all([
      this.watchers.nameOf(actor.id),
      this.watchers.nameOf(candidateId),
      this.watchers.linkFor(context.memberUserIds, candidateId),
    ]);
    await this.watchers.tell(
      {
        companyId: context.companyId,
        memberUserIds: context.memberUserIds,
        candidateId,
        actorId: actor.id,
      },
      { title: `${who} moved ${whom}`, message: `Now at ${where}.`, link },
    );
  }

  /**
   * Notifies a candidate when an employer moves them forward. Advancing to a
   * stage where an interview is likely deep-links into the AI Interview Coach
   * pre-filled for that exact role, so "prep for this" is one click away.
   */
  private async notifyStatusChange(applicationId: string, status: string) {
    const ADVANCING: Record<string, { title: string; prep: boolean }> = {
      shortlisted: { title: 'You have been shortlisted', prep: true },
      interviewing: { title: 'You are moving to interviews', prep: true },
      offered: { title: 'You received an offer', prep: false },
      hired: { title: 'You got the role', prep: false },
    };
    const meta = ADVANCING[status];
    if (!meta) return; // rejected/withdrawn/pending — nothing to celebrate or prep

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        applicantId: true,
        job: { select: { title: true, companyName: true, postedById: true } },
      },
    });
    if (!application?.job) return;

    const role = application.job.title;
    let company = application.job.companyName?.trim();
    if (!company) {
      const employer = await this.prisma.employerProfile.findUnique({
        where: { userId: application.job.postedById },
        select: { companyName: true },
      });
      company = employer?.companyName?.trim() || 'the employer';
    }

    // Prefills the coach's setup wizard with this role.
    const prepLink = `/interview-prep?role=${encodeURIComponent(role)}&company=${encodeURIComponent(company)}`;

    void this.notifications.create({
      userId: application.applicantId,
      type: 'application',
      title: `${meta.title} · ${company}`,
      message: meta.prep
        ? `${role} — practise for this exact role with the AI Interview Coach before you meet them.`
        : `${role} at ${company}.`,
      link: meta.prep ? prepLink : '/activity',
    });
  }

  async bulkUpdateJobApplications(jobId: string, actor: User, dto: BulkUpdateApplicationsDto) {
    await this.assertCanManageApplicationsForJob(jobId, actor);

    const uniqueIds = Array.from(new Set(dto.applicationIds));
    if (uniqueIds.length === 0) {
      throw new BadRequestException('applicationIds cannot be empty');
    }

    const applications = await this.prisma.application.findMany({
      where: {
        id: { in: uniqueIds },
        jobId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (applications.length === 0) {
      throw new NotFoundException('No matching applications found for the specified job');
    }

    const allowedIds: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    for (const application of applications) {
      if (dto.status === ApplicationStatus.WITHDRAWN && actor.role !== UserRole.ADMIN) {
        skipped.push({
          id: application.id,
          reason: 'Only admins can bulk set withdrawn status',
        });
        continue;
      }

      if (
        this.isTerminalStatus(application.status) &&
        actor.role !== UserRole.ADMIN &&
        application.status !== dto.status
      ) {
        skipped.push({
          id: application.id,
          reason: `Terminal application in ${application.status} cannot transition to ${dto.status}`,
        });
        continue;
      }

      allowedIds.push(application.id);
    }

    if (allowedIds.length === 0) {
      return {
        success: true,
        message: 'No applications were eligible for bulk update',
        data: {
          requested: uniqueIds.length,
          matched: applications.length,
          updated: 0,
          skipped,
        },
      };
    }

    const notes = dto.notes !== undefined ? this.normalizeNotes(dto.notes) : undefined;

    const result = await this.prisma.application.updateMany({
      where: { id: { in: allowedIds } },
      data: {
        status: dto.status,
        ...(notes !== undefined ? { notes } : {}),
      },
    });

    // Moving a batch is as much a response as moving one. Scoped to rows that
    // have none, so an earlier, truer first response is never overwritten.
    await this.prisma.application.updateMany({
      where: { id: { in: allowedIds }, firstRespondedAt: null },
      data: { firstRespondedAt: new Date() },
    });

    // Same advance-notification as the single update, for each moved candidate.
    for (const id of allowedIds) {
      void this.notifyStatusChange(id, dto.status);
    }

    const refreshed = await this.prisma.application.findMany({
      where: { id: { in: allowedIds } },
      include: this.buildApplicationInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    return {
      success: true,
      message: 'Bulk application pipeline update completed',
      data: {
        requested: uniqueIds.length,
        matched: applications.length,
        updated: result.count,
        skipped,
        applications: refreshed,
      },
    };
  }

  async withdrawApplication(applicationId: string, actor: User) {
    const existing = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        applicantId: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Application not found');
    }

    const isApplicant = existing.applicantId === actor.id;
    const isAdmin = actor.role === UserRole.ADMIN;

    if (!isApplicant && !isAdmin) {
      throw new ForbiddenException('You can only withdraw your own application');
    }

    if (existing.status === ApplicationStatus.WITHDRAWN) {
      return {
        success: true,
        message: 'Application already withdrawn',
        data: await this.getApplicationById(applicationId, actor),
      };
    }

    // No `firstRespondedAt` here on purpose: withdrawing is the CANDIDATE
    // acting. Counting it would let an employer's responsiveness be improved by
    // the very people who gave up waiting for them.
    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.WITHDRAWN,
      },
      include: this.buildApplicationInclude(),
    });

    return {
      success: true,
      message: 'Application withdrawn successfully',
      data: updated,
    };
  }

  private buildApplicationsWhere(args: {
    query: ListApplicationsQueryDto;
    applicantId?: string;
    jobId?: string;
  }): Prisma.ApplicationWhereInput {
    const where: Prisma.ApplicationWhereInput = {};

    if (args.applicantId) {
      where.applicantId = args.applicantId;
    }

    if (args.jobId) {
      where.jobId = args.jobId;
    }

    if (args.query.status) {
      where.status = args.query.status;
    }

    if (args.query.applicantId && args.applicantId && args.query.applicantId !== args.applicantId) {
      throw new BadRequestException('applicantId query does not match allowed applicant scope');
    }

    if (!args.applicantId && args.query.applicantId) {
      where.applicantId = args.query.applicantId;
    }

    if (args.query.jobId && args.jobId && args.query.jobId !== args.jobId) {
      throw new BadRequestException('jobId query does not match requested job scope');
    }

    if (!args.jobId && args.query.jobId) {
      where.jobId = args.query.jobId;
    }

    if (args.query.query?.trim()) {
      const q = args.query.query.trim();
      where.OR = [
        {
          applicant: {
            email: {
              contains: q,
              mode: 'insensitive',
            },
          },
        },
        {
          applicant: {
            displayName: {
              contains: q,
              mode: 'insensitive',
            },
          },
        },
        {
          applicant: {
            firstName: {
              contains: q,
              mode: 'insensitive',
            },
          },
        },
        {
          applicant: {
            lastName: {
              contains: q,
              mode: 'insensitive',
            },
          },
        },
        {
          job: {
            title: {
              contains: q,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    return where;
  }

  private buildApplicationInclude() {
    return {
      applicant: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          email: true,
        },
      },
      job: {
        select: {
          id: true,
          title: true,
          slug: true,
          postedById: true,
          status: true,
          companyName: true,
          companyLogo: true,
          location: true,
          isRemote: true,
          isHybrid: true,
          employmentType: true,
          experienceLevel: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          createdAt: true,
          publishedAt: true,
        },
      },
    };
  }

  private parseOptionalDate(value: string | undefined, fieldName: string): Date | null {
    if (value === undefined) {
      return null;
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date`);
    }

    return parsed;
  }

  private normalizeNotes(value: string | undefined): string | null {
    if (value === undefined) {
      return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private async assertCanManageApplicationsForJob(jobId: string, actor: User) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        postedById: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    await this.assertCanManageApplications(job.postedById, actor);
  }

  private async assertCanManageApplications(jobOwnerId: string, actor: User) {
    if (actor.role === UserRole.ADMIN || actor.id === jobOwnerId) {
      return;
    }
    const memberIds = await this.companyContext.memberUserIds(actor.id);
    if (memberIds.includes(jobOwnerId)) {
      return;
    }
    throw new ForbiddenException("You can only manage applications for your company's jobs");
  }

  private isTerminalStatus(status: string): boolean {
    return (
      status === ApplicationStatus.HIRED ||
      status === ApplicationStatus.REJECTED ||
      status === ApplicationStatus.WITHDRAWN
    );
  }

  private buildStatusCounts(
    breakdown: Array<{
      status: string;
      _count: { _all: number };
    }>,
  ): Record<ApplicationStatus, number> {
    const seed: Record<ApplicationStatus, number> = {
      pending: 0,
      reviewing: 0,
      shortlisted: 0,
      interviewing: 0,
      offered: 0,
      hired: 0,
      rejected: 0,
      withdrawn: 0,
    };

    for (const row of breakdown) {
      const status = row.status as ApplicationStatus;
      if (seed[status] !== undefined) {
        seed[status] = row._count._all;
      }
    }

    return seed;
  }
}
