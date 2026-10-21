import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LIVE_JOB_STATUSES } from './job-lifecycle.service';
import { PRIVATE_JOB_FIELDS } from './job-visibility';
import { Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ApplicationStatus } from '../applications/dto/update-application-status.dto';
import { User } from '../common/types/user.types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { stagesFromStatuses } from '../common/pipeline-stage';
import { CompanyContextService } from '../company/company-context.service';
import { CompanyAuditService } from '../company/company-audit.service';
import { MatchScoreService } from '../applications/match-score.service';
import { DuplicateJobDto } from './dto/duplicate-job.dto';
import {
  CreateJobDto,
  JOB_STATUSES,
  JobSortValue,
  JobStatusValue,
  ListJobsQueryDto,
  UpdateJobDto,
} from './dto/job.dto';
import { UpdateJobManagementStatusDto } from './dto/update-job-management-status.dto';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly companyContext: CompanyContextService,
    private readonly matchScores: MatchScoreService,
    private readonly audit: CompanyAuditService,
  ) {}

  /**
   * Notifies a company's followers that it just posted a new role. Fire-and-forget
   * (never throws); call only when a job becomes live for the first time.
   */
  private async notifyFollowersOfNewJob(postedById: string, jobTitle: string) {
    try {
      const profile = await this.prisma.employerProfile.findUnique({
        where: { userId: postedById },
        select: { id: true, companyName: true },
      });
      if (!profile) return;

      const followers = await this.prisma.companyFollow.findMany({
        where: { companyId: profile.id },
        select: { userId: true },
      });
      if (followers.length === 0) return;

      await Promise.all(
        followers.map((f) =>
          this.notifications.create({
            userId: f.userId,
            type: 'job',
            title: 'New job posted',
            message: `${profile.companyName} posted a new role: "${jobTitle}".`,
            link: '/jobs',
          }),
        ),
      );
    } catch {
      // A notification failure must never break job publishing.
    }
  }

  async listJobs(query: ListJobsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = this.buildJobsWhere(query, { enforceActiveOnly: true });
    const orderBy = this.buildOrderBy(query.sort);

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        omit: PRIVATE_JOB_FIELDS,
        include: this.buildJobInclude(),
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.job.count({ where }),
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

  async listMyJobs(userId: string, query: ListJobsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = this.buildJobsWhere(query, { enforceActiveOnly: false });
    // The company's jobs, not just this recruiter's — a teammate opening the
    // jobs list should see what the company is hiring for.
    where.postedById = { in: await this.companyContext.memberUserIds(userId) };

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        include: this.buildJobInclude(),
        orderBy: this.buildOrderBy(query.sort),
        skip,
        take: limit,
      }),
      this.prisma.job.count({ where }),
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

  async getEmployerManagementSummary(userId: string) {
    // Company-wide, so the dashboard totals match the jobs list beside them.
    const postedById = { in: await this.companyContext.memberUserIds(userId) };

    const [jobStatusBreakdown, aggregate, savedJobsCount, pipelineStatusBreakdown, recentJobs] =
      await Promise.all([
        this.prisma.job.groupBy({
          by: ['status'],
          where: { postedById },
          _count: { _all: true },
        }),
        this.prisma.job.aggregate({
          where: { postedById },
          _count: { _all: true },
          _sum: {
            viewsCount: true,
            applicationsCount: true,
          },
        }),
        this.prisma.savedJob.count({
          where: {
            job: { postedById },
          },
        }),
        this.prisma.application.groupBy({
          by: ['status'],
          where: {
            job: { postedById },
          },
          _count: {
            _all: true,
          },
        }),
        this.prisma.job.findMany({
          where: { postedById },
          select: {
            id: true,
            title: true,
            status: true,
            viewsCount: true,
            applicationsCount: true,
            publishedAt: true,
            createdAt: true,
            _count: {
              select: {
                savedBy: true,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }],
          take: 8,
        }),
      ]);

    const statusCounts = this.buildStatusCountMap(jobStatusBreakdown);
    const pipelineCounts = this.buildApplicationStatusCountMap(pipelineStatusBreakdown);
    const totalJobs = aggregate._count._all;
    const totalViews = aggregate._sum.viewsCount ?? 0;
    const totalApplications = aggregate._sum.applicationsCount ?? 0;
    const activeJobs = statusCounts.active;
    const closedJobs = statusCounts.closed + statusCounts.archived;
    const openPipelineCount =
      totalApplications -
      (pipelineCounts.rejected + pipelineCounts.withdrawn + pipelineCounts.hired);

    return {
      counters: {
        totalJobs,
        activeJobs,
        draftJobs: statusCounts.draft,
        pausedJobs: statusCounts.paused,
        closedJobs,
        totalViews,
        totalApplications,
        totalSavedJobs: savedJobsCount,
        openPipelineCount: Math.max(openPipelineCount, 0),
        hireCount: pipelineCounts.hired,
      },
      breakdowns: {
        jobsByStatus: statusCounts,
        applicationsByStatus: pipelineCounts,
      },
      recentJobs,
      conversion: {
        applicationPerViewRatePct:
          totalViews > 0 ? this.toPercent((totalApplications / totalViews) * 100) : 0,
        savePerViewRatePct: totalViews > 0 ? this.toPercent((savedJobsCount / totalViews) * 100) : 0,
      },
    };
  }

  async getJobManagementSnapshot(jobId: string, actor: User) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: this.buildJobInclude(),
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    await this.assertJobManagementAccess(job.postedById, actor);

    const [savedCount, applicationStatusBreakdown, recentApplications] =
      await Promise.all([
        this.prisma.savedJob.count({
          where: { jobId },
        }),
        this.prisma.application.groupBy({
          by: ['status'],
          where: { jobId },
          _count: { _all: true },
        }),
        this.prisma.application.findMany({
          where: { jobId },
          select: {
            id: true,
            status: true,
            appliedAt: true,
            updatedAt: true,
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
          },
          orderBy: { appliedAt: 'desc' },
          take: 25,
        }),
      ]);

    const statusCounts = this.buildApplicationStatusCountMap(applicationStatusBreakdown);
    // Folded up from statuses through the shared ladder, in ladder order, so
    // the breakdown reads as a funnel instead of one bucket holding everyone.
    const stageCounts = stagesFromStatuses(applicationStatusBreakdown);

    return {
      // `aiScreened`: the edit form keeps the AI statement locked on.
      job: { ...job, aiScreened: await this.aiHasScreened(jobId) },
      counters: {
        viewsCount: job.viewsCount,
        applicationsCount: job.applicationsCount,
        savedJobsCount: savedCount,
        rejectedCount: statusCounts.rejected,
        hiredCount: statusCounts.hired,
      },
      pipeline: {
        byStatus: statusCounts,
        byStage: stageCounts,
        recentApplications,
      },
      conversion: {
        applicationPerViewRatePct:
          job.viewsCount > 0 ? this.toPercent((job.applicationsCount / job.viewsCount) * 100) : 0,
        savePerViewRatePct: job.viewsCount > 0 ? this.toPercent((savedCount / job.viewsCount) * 100) : 0,
      },
    };
  }

  /**
   * The public job page.
   *
   * Live jobs for everyone; anything else only for the posting company, admins
   * and applicants (see canView). It used to return every job regardless of
   * status — drafts included — along with its five most recent applications
   * and the employer's screening questions, to anyone who asked.
   */
  async getJobById(id: string, viewer?: User | null) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      omit: PRIVATE_JOB_FIELDS,
      include: this.buildJobInclude({ employerBrand: true }),
    });

    if (!job || !(await this.canView(job, viewer))) {
      throw new NotFoundException('Job not found');
    }

    // A team previewing its own draft, or an applicant rereading a closed
    // role, is not a view of an open job.
    if (!LIVE_JOB_STATUSES.includes(job.status)) {
      return job;
    }

    await this.prisma.job.update({
      where: { id },
      data: {
        viewsCount: { increment: 1 },
      },
    });

    return {
      ...job,
      viewsCount: job.viewsCount + 1,
    };
  }

  async createJob(user: User, dto: CreateJobDto) {
    const employmentType = this.resolveRequiredEmploymentType(dto.employmentType, dto.jobType);
    const title = dto.title.trim();
    const description = dto.description.trim();
    const status = this.normalizeStatus(dto.status ?? 'draft');
    const salaryCurrency = this.normalizeCurrency(dto.salaryCurrency ?? 'USD');

    if (!title) {
      throw new BadRequestException('title is required');
    }

    if (!description) {
      throw new BadRequestException('description is required');
    }

    this.assertSalaryRange(dto.salaryMin, dto.salaryMax);

    const postedById = await this.resolvePostedById(user, dto.employerId);
    const manualEmployer = this.resolveManualEmployer(user, dto);

    const created = await this.prisma.job.create({
      data: {
        postedById,
        companyName: manualEmployer.companyName,
        companyLogo: manualEmployer.companyLogo,
        title,
        slug: this.generateSlug(title),
        description,
        category: this.normalizeOptionalText(dto.category),
        employmentType,
        experienceLevel: this.normalizeOptionalText(dto.experienceLevel),
        location: this.normalizeOptionalText(dto.location),
        isRemote: dto.isRemote ?? false,
        isHybrid: dto.isHybrid ?? false,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        salaryCurrency,
        salaryPeriod: this.normalizeOptionalText(dto.salaryPeriod),
        existingVacancy: dto.existingVacancy ?? null,
        usesAi: dto.usesAi ?? false,
        responsibilities: this.normalizeTextArray(dto.responsibilities),
        requirements: this.normalizeTextArray(dto.requirements),
        benefits: this.normalizeTextArray(dto.benefits),
        skills: this.normalizeTextArray(dto.skills),
        applicationDeadline: this.parseOptionalDate(dto.applicationDeadline, 'applicationDeadline'),
        maxApplicants: dto.maxApplicants,
        ...this.resolveApplicationMethod(dto),
        featured: dto.featured ?? false,
        urgent: dto.urgent ?? false,
        status,
        publishedAt: status === 'active' ? new Date() : null,
      },
      include: this.buildJobInclude(),
    });

    if (created.status === 'active') {
      void this.notifyFollowersOfNewJob(created.postedById, created.title);
      void this.audit.recordFor(user, {
        category: 'JOBS',
        action: 'Posted a job',
        entityType: 'Job',
        entityId: created.id,
        entityName: created.title,
        summary: `Posted "${created.title}"`,
      });
    }

    return {
      success: true,
      message: 'Job created successfully',
      data: created,
    };
  }

  async updateJob(jobId: string, actor: User, dto: UpdateJobDto) {
    const existing = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!existing) {
      throw new NotFoundException('Job not found');
    }

    await this.assertJobManagementAccess(existing.postedById, actor);

    const employmentType = this.resolveOptionalEmploymentType(dto.employmentType, dto.jobType);
    const nextSalaryMin = dto.salaryMin ?? existing.salaryMin ?? undefined;
    const nextSalaryMax = dto.salaryMax ?? existing.salaryMax ?? undefined;
    this.assertSalaryRange(nextSalaryMin, nextSalaryMax);

    const nextStatus = dto.status ? this.normalizeStatus(dto.status) : undefined;
    if (nextStatus && nextStatus !== existing.status && actor.role !== UserRole.ADMIN) {
      this.assertStatusTransition(this.normalizeStatus(existing.status), nextStatus);
    }
    const movedToActive = nextStatus === 'active' && existing.status !== 'active';

    // Once Coral's AI has screened this job's applicants, the posting has to
    // keep saying AI is used: removing it would make the posting untrue for
    // everyone already screened. Refused, not quietly kept, so the employer
    // knows why the box won't clear.
    if (dto.usesAi === false && existing.usesAi && (await this.aiHasScreened(jobId))) {
      throw new BadRequestException(
        "AI has already screened applicants for this job, so its posting has to keep saying AI is used.",
      );
    }

    const nextTitle = dto.title?.trim();
    const shouldRegenerateSlug = Boolean(nextTitle && nextTitle !== existing.title);

    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        ...(nextTitle !== undefined ? { title: nextTitle } : {}),
        ...(shouldRegenerateSlug ? { slug: this.generateSlug(nextTitle as string) } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.category !== undefined ? { category: this.normalizeOptionalText(dto.category) } : {}),
        ...(employmentType !== undefined ? { employmentType } : {}),
        ...(dto.experienceLevel !== undefined
          ? { experienceLevel: this.normalizeOptionalText(dto.experienceLevel) }
          : {}),
        ...(dto.location !== undefined ? { location: this.normalizeOptionalText(dto.location) } : {}),
        ...(dto.isRemote !== undefined ? { isRemote: dto.isRemote } : {}),
        ...(dto.isHybrid !== undefined ? { isHybrid: dto.isHybrid } : {}),
        ...(dto.salaryMin !== undefined ? { salaryMin: dto.salaryMin } : {}),
        ...(dto.salaryMax !== undefined ? { salaryMax: dto.salaryMax } : {}),
        ...(dto.salaryCurrency !== undefined
          ? { salaryCurrency: this.normalizeCurrency(dto.salaryCurrency) }
          : {}),
        ...(dto.salaryPeriod !== undefined
          ? { salaryPeriod: this.normalizeOptionalText(dto.salaryPeriod) }
          : {}),
        // Null clears it back to "not stated".
        ...(dto.existingVacancy !== undefined ? { existingVacancy: dto.existingVacancy } : {}),
        ...(dto.usesAi !== undefined ? { usesAi: dto.usesAi } : {}),
        ...(dto.responsibilities !== undefined
          ? { responsibilities: this.normalizeTextArray(dto.responsibilities) }
          : {}),
        ...(dto.requirements !== undefined
          ? { requirements: this.normalizeTextArray(dto.requirements) }
          : {}),
        ...(dto.benefits !== undefined ? { benefits: this.normalizeTextArray(dto.benefits) } : {}),
        ...(dto.skills !== undefined ? { skills: this.normalizeTextArray(dto.skills) } : {}),
        ...(dto.applicationDeadline !== undefined
          ? {
              applicationDeadline: this.parseOptionalDate(
                dto.applicationDeadline,
                'applicationDeadline',
              ),
            }
          : {}),
        ...(dto.maxApplicants !== undefined ? { maxApplicants: dto.maxApplicants } : {}),
        ...(dto.applicationMethod !== undefined ? this.resolveApplicationMethod(dto) : {}),
        ...(dto.featured !== undefined ? { featured: dto.featured } : {}),
        ...(dto.urgent !== undefined ? { urgent: dto.urgent } : {}),
        ...(nextStatus !== undefined ? { status: nextStatus } : {}),
        ...(movedToActive ? { publishedAt: existing.publishedAt ?? new Date() } : {}),
      },
      include: this.buildJobInclude(),
    });

    void this.audit.recordFor(actor, {
      category: 'JOBS',
      action: 'Edited a job',
      entityType: 'Job',
      entityId: updated.id,
      entityName: updated.title,
      summary: `Edited "${updated.title}"`,
      ...(existing.status !== updated.status
        ? { before: { status: existing.status }, after: { status: updated.status } }
        : {}),
    });

    // Changing a job's skills changes every applicant's match score. Not awaited
    // and never allowed to throw — a job edit must not fail because a rescore
    // did, and the nightly sweep catches anything missed.
    if (dto.skills !== undefined) {
      void this.matchScores.recomputeForJob(updated.id).catch(() => undefined);
    }

    // Notify followers only on the first publish (don't re-alert on every reactivation).
    if (movedToActive && !existing.publishedAt) {
      void this.notifyFollowersOfNewJob(updated.postedById, updated.title);
    }

    return {
      success: true,
      message: 'Job updated successfully',
      data: updated,
    };
  }

  async updateJobStatus(jobId: string, actor: User, dto: UpdateJobManagementStatusDto) {
    const existing = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: this.buildJobInclude(),
    });

    if (!existing) {
      throw new NotFoundException('Job not found');
    }

    await this.assertJobManagementAccess(existing.postedById, actor);

    const nextStatus = this.normalizeStatus(dto.status);
    const currentStatus = this.normalizeStatus(existing.status);

    if (nextStatus !== currentStatus && actor.role !== UserRole.ADMIN) {
      this.assertStatusTransition(currentStatus, nextStatus);
    }

    if (nextStatus === currentStatus) {
      return {
        success: true,
        message: `Job already in ${nextStatus} status`,
        data: existing,
      };
    }

    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: nextStatus,
        ...(nextStatus === 'active'
          ? { publishedAt: existing.publishedAt ?? new Date() }
          : nextStatus === 'draft'
            ? { publishedAt: null }
            : {}),
      },
      include: this.buildJobInclude(),
    });

    if (nextStatus === 'active' && !existing.publishedAt) {
      void this.notifyFollowersOfNewJob(updated.postedById, updated.title);
    }

    return {
      success: true,
      message: `Job status updated from ${currentStatus} to ${nextStatus}`,
      data: {
        job: updated,
        transition: {
          from: currentStatus,
          to: nextStatus,
          reason: dto.reason?.trim() || null,
          notifyApplicants: dto.notifyApplicants ?? false,
        },
      },
    };
  }

  async duplicateJob(jobId: string, actor: User, dto: DuplicateJobDto = {}) {
    const existing = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!existing) {
      throw new NotFoundException('Job not found');
    }

    await this.assertJobManagementAccess(existing.postedById, actor);

    const duplicateTitle = (dto.title?.trim() || `${existing.title} (Copy)`).slice(0, 255);
    const targetStatus = dto.status ? this.normalizeStatus(dto.status) : 'draft';

    const duplicated = await this.prisma.job.create({
      data: {
        postedById: existing.postedById,
        title: duplicateTitle,
        slug: this.generateSlug(duplicateTitle),
        description: existing.description,
        category: existing.category,
        employmentType: existing.employmentType,
        experienceLevel: existing.experienceLevel,
        location: existing.location,
        isRemote: existing.isRemote,
        isHybrid: existing.isHybrid,
        salaryMin: existing.salaryMin,
        salaryMax: existing.salaryMax,
        salaryCurrency: existing.salaryCurrency,
        salaryPeriod: existing.salaryPeriod,
        // A copy is usually the same role hired the same way.
        existingVacancy: existing.existingVacancy,
        usesAi: existing.usesAi,
        responsibilities: existing.responsibilities,
        requirements: existing.requirements,
        benefits: existing.benefits,
        skills: existing.skills,
        applicationDeadline: existing.applicationDeadline,
        maxApplicants: existing.maxApplicants,
        featured: existing.featured,
        urgent: existing.urgent,
        status: targetStatus,
        viewsCount: 0,
        applicationsCount: 0,
        publishedAt: targetStatus === 'active' ? new Date() : null,
      },
      include: this.buildJobInclude(),
    });

    if (duplicated.status === 'active') {
      void this.notifyFollowersOfNewJob(duplicated.postedById, duplicated.title);
    }

    return {
      success: true,
      message: 'Job duplicated successfully',
      data: duplicated,
    };
  }

  async deleteJob(jobId: string, actor: User) {
    const existing = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        postedById: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Job not found');
    }

    await this.assertJobManagementAccess(existing.postedById, actor);

    await this.prisma.job.delete({
      where: { id: jobId },
    });

    return {
      success: true,
      message: 'Job deleted successfully',
    };
  }

  async saveJob(userId: string, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!job || job.status !== 'active') {
      throw new NotFoundException('Active job not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.savedJob.findUnique({
        where: {
          userId_jobId: {
            userId,
            jobId,
          },
        },
      });

      if (existing) {
        return {
          changed: false,
          saved: existing,
        };
      }

      const saved = await tx.savedJob.create({
        data: {
          userId,
          jobId,
        },
      });

      return {
        changed: true,
        saved,
      };
    });

    return {
      success: true,
      message: result.changed ? 'Job saved successfully' : 'Job already saved',
      data: {
        jobId,
        saved: true,
        changed: result.changed,
        savedJobId: result.saved.id,
      },
    };
  }

  async unsaveJob(userId: string, jobId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.savedJob.findUnique({
        where: {
          userId_jobId: {
            userId,
            jobId,
          },
        },
      });

      if (!existing) {
        return { changed: false };
      }

      await tx.savedJob.delete({
        where: {
          userId_jobId: {
            userId,
            jobId,
          },
        },
      });

      return { changed: true };
    });

    return {
      success: true,
      message: result.changed ? 'Job removed from saved jobs' : 'Job was not in saved jobs',
      data: {
        jobId,
        saved: false,
        changed: result.changed,
      },
    };
  }

  private buildJobsWhere(
    query: ListJobsQueryDto,
    options: { enforceActiveOnly: boolean },
  ): Prisma.JobWhereInput {
    const where: Prisma.JobWhereInput = {};

    if (options.enforceActiveOnly) {
      // Both vocabularies count as live: the admin panel writes 'published'
      // while everything else writes 'active', so filtering on one hides the
      // other's jobs from the public site entirely.
      where.status = { in: LIVE_JOB_STATUSES };
      // A job past its deadline is not an open position. The deadline was
      // being stored and never read, so expired roles stayed listed and
      // accepted applications indefinitely.
      where.AND = [
        {
          OR: [{ applicationDeadline: null }, { applicationDeadline: { gte: new Date() } }],
        },
      ];
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.query?.trim()) {
      const normalizedQuery = query.query.trim();
      const terms = this.extractQueryTerms(normalizedQuery);

      where.OR = [
        {
          title: {
            contains: normalizedQuery,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: normalizedQuery,
            mode: 'insensitive',
          },
        },
        ...(terms.length > 0
          ? [
              {
                skills: {
                  hasSome: terms,
                },
              },
            ]
          : []),
      ];
    }

    if (query.location?.trim()) {
      where.location = {
        contains: query.location.trim(),
        mode: 'insensitive',
      };
    }

    if (query.employmentType?.trim()) {
      where.employmentType = {
        equals: query.employmentType.trim(),
        mode: 'insensitive',
      };
    }

    if (query.experienceLevel?.trim()) {
      where.experienceLevel = {
        equals: query.experienceLevel.trim(),
        mode: 'insensitive',
      };
    }

    if (query.remoteOnly === true) {
      where.isRemote = true;
    }

    if (query.minSalary !== undefined) {
      where.salaryMax = {
        gte: query.minSalary,
      };
    }

    if (query.maxSalary !== undefined) {
      where.salaryMin = {
        lte: query.maxSalary,
      };
    }

    if (query.featured === true) {
      where.featured = true;
    }

    if (query.postedById) {
      where.postedById = query.postedById;
    }

    return where;
  }

  private buildOrderBy(sort?: JobSortValue): Prisma.JobOrderByWithRelationInput[] {
    switch (sort) {
      case 'oldest':
        return [{ createdAt: 'asc' }];
      case 'salary_asc':
        return [{ salaryMin: 'asc' }, { createdAt: 'desc' }];
      case 'salary_desc':
        return [{ salaryMax: 'desc' }, { createdAt: 'desc' }];
      case 'newest':
      default:
        return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
    }
  }

  /**
   * @param opts.employerBrand adds the employer's brand content — why-work-here
   *   cards, values, awards, DEI stats, gallery. Off by default because these
   *   are large JSON arrays that only the job detail view renders; carrying
   *   them on every row of a paginated list would be paid for by everyone and
   *   read by no one.
   */
  private buildJobInclude(opts: { employerBrand?: boolean } = {}) {
    return {
      postedBy: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
          employerProfile: {
            select: {
              companyName: true,
              companyLogo: true,
              // The employer's own words — authoritative, unlike web research.
              tagline: true,
              companyDescription: true,
              companyWebsite: true,
              industry: true,
              companySize: true,
              headquarters: true,
              foundedYear: true,
              companyCulture: true,
              companyBenefits: true,
              /** Cheap, and worth showing wherever the company appears. */
              id: true,
              verificationStatus: true,
              ...(opts.employerBrand
                ? {
                    mission: true,
                    whyWorkHere: true,
                    coreValues: true,
                    awards: true,
                    diversityStatement: true,
                    deiStats: true,
                    galleryPhotos: true,
                  }
                : {}),
            },
          },
        },
      },
      _count: {
        select: {
          applications: true,
          savedBy: true,
        },
      },
    };
  }

  private resolveRequiredEmploymentType(employmentType?: string, jobType?: string): string {
    const resolved = (employmentType ?? jobType)?.trim();
    if (!resolved) {
      throw new BadRequestException('employmentType (or jobType) is required');
    }
    return resolved;
  }

  private resolveOptionalEmploymentType(
    employmentType?: string,
    jobType?: string,
  ): string | undefined {
    const resolved = (employmentType ?? jobType)?.trim();
    return resolved || undefined;
  }

  private normalizeCurrency(currency: string): string {
    const normalized = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized)) {
      throw new BadRequestException('salaryCurrency must be a valid 3-letter code');
    }
    return normalized;
  }

  /**
   * How candidates apply. `external` and `email` are only honoured when they
   * carry a destination — otherwise the job would advertise a route that goes
   * nowhere, so we reject rather than silently falling back to Quick Apply.
   */
  private resolveApplicationMethod(dto: {
    applicationMethod?: string;
    applicationUrl?: string;
    applicationEmail?: string;
  }): { applicationMethod: string; applicationUrl: string | null; applicationEmail: string | null } {
    const method = dto.applicationMethod ?? 'internal';

    if (method === 'external') {
      const url = (dto.applicationUrl ?? '').trim();
      let valid = false;
      try {
        const parsed = new URL(url);
        valid = parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        valid = false;
      }
      if (!valid) {
        throw new BadRequestException(
          'A valid http(s) application URL is required when applications go to your website.',
        );
      }
      return { applicationMethod: 'external', applicationUrl: url, applicationEmail: null };
    }

    if (method === 'email') {
      const email = (dto.applicationEmail ?? '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException(
          'A valid application email is required when applications are sent by email.',
        );
      }
      return { applicationMethod: 'email', applicationUrl: null, applicationEmail: email };
    }

    // Quick Apply on-platform — clear any stale destination from a previous method.
    return { applicationMethod: 'internal', applicationUrl: null, applicationEmail: null };
  }

  /** Minimal job row for lookups that only need identity fields. */
  async getJobEntity(id: string) {
    return this.prisma.job.findUnique({
      where: { id },
      select: { id: true, title: true, companyName: true, status: true },
    });
  }

  /** Like getJobEntity, but null unless `viewer` may see the job (see canView). */
  async getVisibleJobEntity(id: string, viewer?: User | null) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      select: { id: true, title: true, companyName: true, status: true, postedById: true },
    });
    return job && (await this.canView(job, viewer)) ? job : null;
  }

  /**
   * Whether `viewer` may read this job. Live jobs: anyone. Otherwise the
   * company that posted it (any member), admins, and people who applied.
   */
  private async canView(
    job: { id: string; status: string; postedById: string },
    viewer?: User | null,
  ): Promise<boolean> {
    if (LIVE_JOB_STATUSES.includes(job.status)) return true;
    if (!viewer) return false;
    if (viewer.role === UserRole.ADMIN || viewer.id === job.postedById) return true;
    if ((await this.companyContext.memberUserIds(viewer.id)).includes(job.postedById)) return true;
    const applied = await this.prisma.application.findFirst({
      where: { jobId: job.id, applicantId: viewer.id },
      select: { id: true },
    });
    return !!applied;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
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

  private normalizeTextArray(values?: string[]): string[] {
    if (!values || values.length === 0) {
      return [];
    }

    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const value of values) {
      const cleaned = value.trim().replace(/\s+/g, ' ');
      const key = cleaned.toLowerCase();
      if (!cleaned || seen.has(key)) {
        continue;
      }
      seen.add(key);
      normalized.push(cleaned);
    }

    return normalized;
  }

  private extractQueryTerms(value: string): string[] {
    const tokens = value
      .split(/[\s,]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1)
      .slice(0, 10);

    return this.normalizeTextArray(tokens);
  }

  /**
   * Whether Coral's AI has screened any of this job's applicants: written or
   * live rounds, which the AI scores. Video answers are judged by the employer.
   */
  private async aiHasScreened(jobId: string): Promise<boolean> {
    return (await this.prisma.aiScreen.count({ where: { jobId, mode: { in: ['text', 'live'] } } })) > 0;
  }

  private assertSalaryRange(minSalary?: number, maxSalary?: number) {
    if (
      minSalary !== undefined &&
      maxSalary !== undefined &&
      minSalary > maxSalary
    ) {
      throw new BadRequestException('salaryMin cannot be greater than salaryMax');
    }
  }

  private async resolvePostedById(actor: User, employerId?: string): Promise<string> {
    if (!employerId) {
      return actor.id;
    }

    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can post a job on behalf of an employer');
    }

    const employer = await this.prisma.user.findUnique({ where: { id: employerId } });
    if (!employer || employer.role !== UserRole.EMPLOYER) {
      throw new BadRequestException('employerId must reference an existing employer account');
    }

    return employer.id;
  }

  private resolveManualEmployer(actor: User, dto: CreateJobDto): { companyName: string | null; companyLogo: string | null } {
    const companyName = this.normalizeOptionalText(dto.companyName);
    const companyLogo = this.normalizeOptionalText(dto.companyLogo);

    if (!companyName && !companyLogo) {
      return { companyName: null, companyLogo: null };
    }

    if (actor.role !== UserRole.ADMIN || dto.employerId) {
      throw new BadRequestException('companyName/companyLogo can only be set by an admin posting without a linked employer');
    }

    return { companyName, companyLogo };
  }

  /**
   * Jobs belong to the company, not to whoever happened to post them.
   *
   * Scoping this to the actor alone would mean a colleague can see a job on the
   * dashboard and then be refused when they try to edit it — and it would leave
   * a company unable to touch its own listings the moment the recruiter who
   * created them leaves.
   */
  private async assertJobManagementAccess(postedById: string, actor: User) {
    if (actor.role === UserRole.ADMIN || postedById === actor.id) {
      return;
    }

    const memberIds = await this.companyContext.memberUserIds(actor.id);
    if (memberIds.includes(postedById)) {
      return;
    }

    throw new ForbiddenException('You can only manage jobs posted by your company');
  }

  private assertStatusTransition(currentStatus: JobStatusValue, nextStatus: JobStatusValue) {
    const allowedTransitions: Record<JobStatusValue, JobStatusValue[]> = {
      draft: ['active', 'archived'],
      active: ['paused', 'closed', 'archived'],
      paused: ['active', 'closed', 'archived'],
      closed: ['active', 'archived'],
      archived: ['draft', 'active'],
    };

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${nextStatus}`,
      );
    }
  }

  private generateSlug(title: string): string {
    const normalized = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 80);

    const suffix = randomUUID().slice(0, 8);
    return `${normalized || 'job'}-${suffix}`;
  }

  private normalizeStatus(status: string): JobStatusValue {
    const normalized = status.trim().toLowerCase();
    if (!JOB_STATUSES.includes(normalized as JobStatusValue)) {
      throw new BadRequestException(`Invalid job status. Allowed: ${JOB_STATUSES.join(', ')}`);
    }
    return normalized as JobStatusValue;
  }

  private buildStatusCountMap(
    breakdown: Array<{ status: string; _count: { _all: number } }>,
  ): Record<JobStatusValue, number> {
    const seed: Record<JobStatusValue, number> = {
      draft: 0,
      active: 0,
      paused: 0,
      closed: 0,
      archived: 0,
    };

    for (const row of breakdown) {
      const status = row.status as JobStatusValue;
      if (seed[status] !== undefined) {
        seed[status] = row._count._all;
      }
    }

    return seed;
  }

  private buildApplicationStatusCountMap(
    breakdown: Array<{ status: string; _count: { _all: number } }>,
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

  private toPercent(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
