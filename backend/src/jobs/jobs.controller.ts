import {
  NotFoundException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { ApplicationsService } from '../applications/applications.service';
import { CreateJobApplicationDto } from '../applications/dto/create-job-application.dto';
import { ListApplicationsQueryDto } from '../applications/dto/list-applications-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/types/user.types';
import { LIVE_JOB_STATUSES } from './job-lifecycle.service';
import { AnalyticsEventsService } from '../analytics/analytics-events.service';
import { EmployerVerificationService } from '../employers/employer-verification.service';
import { DuplicateJobDto } from './dto/duplicate-job.dto';
import { CreateJobDto, ListJobsQueryDto, UpdateJobDto } from './dto/job.dto';
import { UpdateJobManagementStatusDto } from './dto/update-job-management-status.dto';
import { JobsService } from './jobs.service';
import { JobMatchService } from './job-match.service';
import { JobFitService } from './job-fit.service';
import { CompanyResearchService } from '../resume-matcher/company-research/company-research.service';
import { MatchJobsDto } from './dto/match-jobs.dto';
import { CompanyCapabilityGuard, RequiresCapability } from '../company/company-capability.guard';

@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly applicationsService: ApplicationsService,
    private readonly jobMatchService: JobMatchService,
    private readonly jobFitService: JobFitService,
    private readonly companyResearchService: CompanyResearchService,
    private readonly analyticsEvents: AnalyticsEventsService,
    private readonly verification: EmployerVerificationService,
  ) {}

  /**
   * AI fit scores for the jobs currently on screen. Scores are null when we
   * have no profile signal to judge on — the UI shows "—", never a guess.
   */
  @Post('match')
  @Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
  async matchJobs(@CurrentUser() user: User, @Body() dto: MatchJobsDto) {
    return { success: true, data: await this.jobMatchService.scoreForUser(user, dto.jobIds) };
  }

  /** Matched/missing skills for one job, plus an AI verdict. */
  @Get(':id/fit')
  @Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
  async jobFit(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.jobFitService.getFit(user, id) };
  }

  /** Rewrites the candidate's stored resume toward this job. */
  @Post(':id/tailor-resume')
  @Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
  async tailorForJob(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.jobFitService.tailorForJob(user, id) };
  }

  /**
   * What this company is actually like — summarised from real web sources.
   * Returns { configured: false } when Firecrawl isn't set up, so the UI can
   * say so rather than showing an empty panel.
   */
  @Public()
  @Get(':id/company-research')
  async companyResearch(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    // Same visibility as the job page: an unpublished job's company and title
    // aren't anyone else's to look up.
    const job = await this.jobsService.getVisibleJobEntity(id, this.viewer(req));
    if (!job) throw new NotFoundException('Job not found');
    const company = job.companyName?.trim();
    if (!company) {
      return { success: true, data: { configured: true, profile: null, sources: [] } };
    }
    return {
      success: true,
      data: await this.companyResearchService.research(company, job.title),
    };
  }

  @Public()
  @Get()
  async listJobs(@Query() query: ListJobsQueryDto) {
    return {
      success: true,
      ...(await this.jobsService.listJobs(query)),
    };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Get('me/summary')
  async getMyJobsSummary(@CurrentUser() user: User) {
    return {
      success: true,
      data: await this.jobsService.getEmployerManagementSummary(user.id),
    };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Get('me')
  async listMyJobs(@CurrentUser() user: User, @Query() query: ListJobsQueryDto) {
    return {
      success: true,
      ...(await this.jobsService.listMyJobs(user.id, query)),
    };
  }

  @Public()
  @Get(':id')
  async getJobById(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    // Signed-in readers are known here even though the route is public (the
    // guard attaches a valid session), which is what lets a company preview
    // its own draft.
    const job = await this.jobsService.getJobById(id, this.viewer(req));

    // Captured here rather than in the service because only the controller has
    // the request context, and because a view is a side effect of reading the
    // page — record() is fire-and-forget and never fails this response.
    // Only live jobs count: previews and applicants rereading a closed role
    // are not views of an open position.
    if (LIVE_JOB_STATUSES.includes(job.status)) this.analyticsEvents.record({
      type: 'job_view',
      employerId: job.postedById,
      jobId: id,
      viewerId: (req as Request & { user?: { id?: string } }).user?.id ?? null,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'] ?? null,
      referer: (req.headers.referer as string) ?? null,
    });

    return { success: true, data: job };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @RequiresCapability('jobs:write')
  @Post()
  async createJob(@CurrentUser() user: User, @Body() dto: CreateJobDto) {
    // Anti-scam boundary: an unverified account must not publish a job that
    // collects CVs from candidates.
    if (user.role !== UserRole.ADMIN) await this.verification.assertCanReachCandidates(user.id);
    return this.jobsService.createJob(user, dto);
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Get(':id/management')
  async getJobManagementSnapshot(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return {
      success: true,
      data: await this.jobsService.getJobManagementSnapshot(id, user),
    };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @RequiresCapability('jobs:write')
  @Patch(':id')
  async updateJob(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateJobDto,
  ) {
    if (dto.status === 'active' && user.role !== UserRole.ADMIN) {
      await this.verification.assertCanReachCandidates(user.id);
    }
    return this.jobsService.updateJob(id, user, dto);
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @RequiresCapability('jobs:write')
  @Patch(':id/status')
  async updateJobStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateJobManagementStatusDto,
  ) {
    if (dto.status === 'active' && user.role !== UserRole.ADMIN) {
      await this.verification.assertCanReachCandidates(user.id);
    }
    return this.jobsService.updateJobStatus(id, user, dto);
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @RequiresCapability('jobs:write')
  @Post(':id/duplicate')
  async duplicateJob(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: DuplicateJobDto,
  ) {
    if (dto?.status === 'active' && user.role !== UserRole.ADMIN) {
      await this.verification.assertCanReachCandidates(user.id);
    }
    return this.jobsService.duplicateJob(id, user, dto ?? {});
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @RequiresCapability('jobs:write')
  @Delete(':id')
  deleteJob(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.jobsService.deleteJob(id, user);
  }

  @Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
  @Post(':id/apply')
  applyToJob(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: CreateJobApplicationDto,
  ) {
    return this.applicationsService.createApplication(user.id, {
      jobId: id,
      ...dto,
    });
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Get(':id/applications')
  async listJobApplications(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query() query: ListApplicationsQueryDto,
  ) {
    return {
      success: true,
      ...(await this.applicationsService.listJobApplications(id, user, query)),
    };
  }

  @Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
  @Post(':id/save')
  saveJob(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.jobsService.saveJob(user.id, id);
  }

  @Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
  @Delete(':id/save')
  unsaveJob(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.jobsService.unsaveJob(user.id, id);
  }

  /** The signed-in reader on a public route, if the guard found one. */
  private viewer(req: Request): User | null {
    return ((req as Request & { user?: User }).user as User | undefined) ?? null;
  }
}
