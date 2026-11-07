import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CompanyMemberStatus, PipelineStage, UserRole } from '@prisma/client';
import { ApplicationStatus } from '../applications/dto/update-application-status.dto';
import { stagesFromStatuses } from '../common/pipeline-stage';
import { User } from '../common/types/user.types';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /**
   * The caller's figures. `side: 'company'` is the company dashboard asking:
   * one account can look for work and act for a company through a seat, so
   * the account's role says nothing about which figures are wanted. It used to
   * answer a job seeker with a seat with job-seeker figures, and the
   * dashboard crashed reading trends they don't have.
   */
  async getMyAnalytics(user: User, side?: string) {
    if (side === 'company') return this.getEmployerAnalytics(user.id);
    switch (user.role) {
      case UserRole.EMPLOYER:
        return this.getEmployerAnalytics(user.id);
      case UserRole.ADMIN:
        return this.getAdminAnalytics();
      case UserRole.JOB_SEEKER:
        return this.getJobSeekerAnalytics(user.id);
      case UserRole.FREELANCER:
      default:
        return this.getFreelancerAnalytics(user.id);
    }
  }

  async getJobAnalytics(jobId: string, actor: User) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        status: true,
        postedById: true,
        viewsCount: true,
        applicationsCount: true,
        createdAt: true,
        publishedAt: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (actor.role !== UserRole.ADMIN && actor.id !== job.postedById) {
      throw new ForbiddenException('You can only view analytics for your own jobs');
    }

    const [savedCount, statusBreakdown, applicationsTimeline, savesTimeline] =
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
          where: {
            jobId,
            appliedAt: {
              gte: this.daysAgo(30),
            },
          },
          select: {
            appliedAt: true,
          },
          orderBy: { appliedAt: 'asc' },
        }),
        this.prisma.savedJob.findMany({
          where: {
            jobId,
            createdAt: {
              gte: this.daysAgo(30),
            },
          },
          select: {
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

    const statusCounts = this.buildApplicationStatusCounts(statusBreakdown);
    const stageCounts = stagesFromStatuses(statusBreakdown);

    return {
      job,
      counters: {
        viewsCount: job.viewsCount,
        applicationsCount: job.applicationsCount,
        savedJobsCount: savedCount,
        pendingCount: statusCounts.pending,
        interviewingCount: statusCounts.interviewing,
        offeredCount: statusCounts.offered,
        hiredCount: statusCounts.hired,
        rejectedCount: statusCounts.rejected,
      },
      breakdowns: {
        applicationsByStatus: statusCounts,
        applicationsByStage: stageCounts,
      },
      timeline: {
        applicationsLast30Days: this.toDailySeries(
          applicationsTimeline.map((row) => row.appliedAt),
          30,
        ),
        savesLast30Days: this.toDailySeries(
          savesTimeline.map((row) => row.createdAt),
          30,
        ),
      },
      conversion: {
        applicationPerViewRatePct:
          job.viewsCount > 0 ? this.toPercent((job.applicationsCount / job.viewsCount) * 100) : 0,
        savePerViewRatePct: job.viewsCount > 0 ? this.toPercent((savedCount / job.viewsCount) * 100) : 0,
        hirePerApplicationRatePct:
          job.applicationsCount > 0
            ? this.toPercent((statusCounts.hired / job.applicationsCount) * 100)
            : 0,
      },
    };
  }

  async getCompanyAnalytics(companyId: string, actor: User) {
    // Membership, not a profile row: a teammate who joined from a personal
    // account has a seat and no employer profile of their own.
    if (actor.role !== UserRole.ADMIN) {
      const seat = await this.prisma.companyMember.findFirst({
        where: { userId: actor.id, companyId, status: CompanyMemberStatus.ACTIVE },
        select: { id: true },
      });

      if (!seat) {
        throw new ForbiddenException('You can only view analytics for your own company');
      }
    }

    // Everyone whose records are the company's (the fan-out rule).
    const owners = await this.prisma.companyMember.findMany({
      where: {
        companyId,
        status: { in: [CompanyMemberStatus.ACTIVE, CompanyMemberStatus.SUSPENDED, CompanyMemberStatus.REMOVED] },
      },
      select: {
        userId: true,
      },
    });

    const ownerIds = Array.from(new Set(owners.map((entry) => entry.userId)));

    if (ownerIds.length === 0) {
      return {
        companyId,
        counters: {
          ownerCount: 0,
          jobsCount: 0,
          activeJobs: 0,
          viewsCount: 0,
          applicationsCount: 0,
          savedJobsCount: 0,
          hiredCount: 0,
        },
        breakdowns: {
          jobsByStatus: this.buildJobStatusCounts([]),
          applicationsByStatus: this.buildApplicationStatusCounts([]),
        },
        topJobs: [],
      };
    }

    const [jobs, savedJobsCount, applicationsByStatus] = await Promise.all([
      this.prisma.job.findMany({
        where: {
          postedById: { in: ownerIds },
        },
        select: {
          id: true,
          title: true,
          status: true,
          viewsCount: true,
          applicationsCount: true,
          createdAt: true,
          publishedAt: true,
        },
        orderBy: [{ applicationsCount: 'desc' }, { viewsCount: 'desc' }],
      }),
      this.prisma.savedJob.count({
        where: {
          job: {
            postedById: { in: ownerIds },
          },
        },
      }),
      this.prisma.application.groupBy({
        by: ['status'],
        where: {
          job: {
            postedById: { in: ownerIds },
          },
        },
        _count: { _all: true },
      }),
    ]);

    const jobsByStatus = this.buildJobStatusCounts(
      this.groupByKey(jobs, (job) => job.status),
    );
    const appStatusCounts = this.buildApplicationStatusCounts(applicationsByStatus);
    const viewsCount = jobs.reduce((sum, job) => sum + job.viewsCount, 0);
    const applicationsCount = jobs.reduce((sum, job) => sum + job.applicationsCount, 0);

    return {
      companyId,
      counters: {
        ownerCount: ownerIds.length,
        jobsCount: jobs.length,
        activeJobs: jobsByStatus.active,
        viewsCount,
        applicationsCount,
        savedJobsCount,
        hiredCount: appStatusCounts.hired,
      },
      breakdowns: {
        jobsByStatus,
        applicationsByStatus: appStatusCounts,
      },
      topJobs: jobs.slice(0, 10),
      conversion: {
        applicationPerViewRatePct:
          viewsCount > 0 ? this.toPercent((applicationsCount / viewsCount) * 100) : 0,
        savePerViewRatePct: viewsCount > 0 ? this.toPercent((savedJobsCount / viewsCount) * 100) : 0,
      },
    };
  }

  private async getJobSeekerAnalytics(userId: string) {
    const [applicationsTotal, applicationsByStatus, savedJobsCount, activeAlertsCount, recentApplications] =
      await Promise.all([
        this.prisma.application.count({
          where: { applicantId: userId },
        }),
        this.prisma.application.groupBy({
          by: ['status'],
          where: { applicantId: userId },
          _count: { _all: true },
        }),
        this.prisma.savedJob.count({
          where: { userId },
        }),
        this.prisma.jobAlert.count({
          where: {
            userId,
            isActive: true,
          },
        }),
        this.prisma.application.findMany({
          where: { applicantId: userId },
          select: {
            id: true,
            status: true,
            appliedAt: true,
            updatedAt: true,
            job: {
              select: {
                id: true,
                title: true,
                slug: true,
                status: true,
              },
            },
          },
          orderBy: { appliedAt: 'desc' },
          take: 8,
        }),
      ]);

    const statusCounts = this.buildApplicationStatusCounts(applicationsByStatus);
    const responded =
      applicationsTotal - statusCounts.pending - statusCounts.withdrawn;

    return {
      role: UserRole.JOB_SEEKER,
      counters: {
        applicationsTotal,
        savedJobsCount,
        activeAlertsCount,
        interviewingCount: statusCounts.interviewing,
        offeredCount: statusCounts.offered,
        hiredCount: statusCounts.hired,
      },
      breakdowns: {
        applicationsByStatus: statusCounts,
      },
      conversion: {
        responseRatePct:
          applicationsTotal > 0 ? this.toPercent((responded / applicationsTotal) * 100) : 0,
      },
      recentApplications,
    };
  }

  /** The company's figures: every member's jobs (the fan-out rule), or the caller's own with no company. */
  private async getEmployerAnalytics(userId: string) {
    const memberIds = await this.companyContext.memberUserIds(userId);
    const startOfToday = this.daysAgo(0);
    const sevenDaysAgo = this.daysAgo(7);
    const fourteenDaysAgo = this.daysAgo(14);

    const [
      jobs,
      savedJobsCount,
      applicationsByStatus,
      recentApplications,
      applicationsToday,
      applicationsThisWeek,
      applicationsPrevWeek,
    ] = await Promise.all([
      this.prisma.job.findMany({
        where: { postedById: { in: memberIds } },
        select: {
          id: true,
          title: true,
          status: true,
          viewsCount: true,
          applicationsCount: true,
          createdAt: true,
          publishedAt: true,
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.savedJob.count({
        where: {
          job: {
            postedById: { in: memberIds },
          },
        },
      }),
      this.prisma.application.groupBy({
        by: ['status'],
        where: {
          job: {
            postedById: { in: memberIds },
          },
        },
        _count: { _all: true },
      }),
      this.prisma.application.findMany({
        where: {
          job: {
            postedById: { in: memberIds },
          },
        },
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
              email: true,
            },
          },
          job: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
        orderBy: { appliedAt: 'desc' },
        take: 12,
      }),
      this.prisma.application.count({
        where: { job: { postedById: { in: memberIds } }, appliedAt: { gte: startOfToday } },
      }),
      this.prisma.application.count({
        where: { job: { postedById: { in: memberIds } }, appliedAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.application.count({
        where: {
          job: { postedById: { in: memberIds } },
          appliedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
      }),
    ]);

    const jobsByStatus = this.buildJobStatusCounts(this.groupByKey(jobs, (job) => job.status));
    const appStatusCounts = this.buildApplicationStatusCounts(applicationsByStatus);
    const viewsCount = jobs.reduce((sum, job) => sum + job.viewsCount, 0);
    const applicationsCount = jobs.reduce((sum, job) => sum + job.applicationsCount, 0);
    const stageCounts = stagesFromStatuses(applicationsByStatus);

    const newActiveJobsThisWeek = jobs.filter(
      (job) => job.status === 'active' && job.publishedAt !== null && job.publishedAt >= sevenDaysAgo,
    ).length;

    const applicantsWeekOverWeekPct =
      applicationsPrevWeek > 0
        ? this.toPercent(((applicationsThisWeek - applicationsPrevWeek) / applicationsPrevWeek) * 100)
        : applicationsThisWeek > 0
          ? 100
          : 0;

    return {
      role: UserRole.EMPLOYER,
      counters: {
        jobsCount: jobs.length,
        activeJobs: jobsByStatus.active,
        draftJobs: jobsByStatus.draft,
        pausedJobs: jobsByStatus.paused,
        viewsCount,
        applicationsCount,
        savedJobsCount,
        hiredCount: appStatusCounts.hired,
        applicationsToday,
        newActiveJobsThisWeek,
      },
      breakdowns: {
        jobsByStatus,
        applicationsByStatus: appStatusCounts,
        applicationsByStage: stageCounts,
      },
      conversion: {
        applicationPerViewRatePct:
          viewsCount > 0 ? this.toPercent((applicationsCount / viewsCount) * 100) : 0,
        savePerViewRatePct: viewsCount > 0 ? this.toPercent((savedJobsCount / viewsCount) * 100) : 0,
        viewsPerApplication:
          applicationsCount > 0 ? Math.round((viewsCount / applicationsCount) * 10) / 10 : 0,
      },
      trends: {
        applicantsWeekOverWeekPct,
      },
      topJobs: [...jobs]
        .sort((left, right) => {
          if (right.applicationsCount !== left.applicationsCount) {
            return right.applicationsCount - left.applicationsCount;
          }
          return right.viewsCount - left.viewsCount;
        })
        .slice(0, 8),
      recentApplications,
    };
  }

  private async getAdminAnalytics() {
    const [usersCount, jobsCount, applicationsCount, activeJobsCount, postsCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.job.count(),
      this.prisma.application.count(),
      this.prisma.job.count({
        where: { status: 'active' },
      }),
      this.prisma.post.count(),
    ]);

    return {
      role: UserRole.ADMIN,
      counters: {
        usersCount,
        jobsCount,
        activeJobsCount,
        applicationsCount,
        postsCount,
      },
    };
  }

  /**
   * Not completed projects, rating or earnings: those were typed in by the
   * freelancer and never measured. How they reply to requests is measured,
   * at GET /freelancers/me/responsiveness.
   */
  private async getFreelancerAnalytics(userId: string) {
    const postsCount = await this.prisma.post.count({
      where: { authorId: userId },
    });

    return {
      role: UserRole.FREELANCER,
      counters: {
        postsCount,
      },
    };
  }

  private buildApplicationStatusCounts(
    rows: Array<{ status: string; _count: { _all: number } }>,
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

    for (const row of rows) {
      const key = row.status as ApplicationStatus;
      if (seed[key] !== undefined) {
        seed[key] = row._count._all;
      }
    }

    return seed;
  }

  private buildJobStatusCounts(rows: Array<{ key: string; count: number }>) {
    const seed: Record<'draft' | 'active' | 'paused' | 'closed' | 'archived', number> = {
      draft: 0,
      active: 0,
      paused: 0,
      closed: 0,
      archived: 0,
    };

    for (const row of rows) {
      const key = row.key as keyof typeof seed;
      if (seed[key] !== undefined) {
        seed[key] = row.count;
      }
    }

    return seed;
  }

  private groupByKey<T>(items: T[], toKey: (item: T) => string): Array<{ key: string; count: number }> {
    const map = new Map<string, number>();

    for (const item of items) {
      const key = toKey(item);
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    return Array.from(map.entries()).map(([key, count]) => ({ key, count }));
  }

  private toDailySeries(dates: Date[], days: number): Array<{ date: string; count: number }> {
    const start = this.daysAgo(days - 1);
    const counters = new Map<string, number>();

    for (let index = 0; index < days; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      counters.set(this.toIsoDate(date), 0);
    }

    for (const date of dates) {
      const key = this.toIsoDate(date);
      if (counters.has(key)) {
        counters.set(key, (counters.get(key) ?? 0) + 1);
      }
    }

    return Array.from(counters.entries()).map(([date, count]) => ({ date, count }));
  }

  private daysAgo(days: number): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - days);
    return date;
  }

  private toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toPercent(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
