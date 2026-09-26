import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/types/user.types';
import { ApplicationsService } from './applications.service';
import { BulkUpdateApplicationsDto } from './dto/bulk-update-applications.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { ApplicantsQueryDto } from './dto/applicants-query.dto';
import { PipelineQueryDto } from './dto/pipeline-query.dto';
import { PipelineService } from './pipeline.service';
import { UpdateApplicationPipelineDto } from './dto/update-application-pipeline.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { CompanyCapabilityGuard, RequiresCapability } from '../company/company-capability.guard';

@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
export class ApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
    private readonly pipeline: PipelineService,
  ) {}

  @Get('me')
  async listMyApplications(@CurrentUser() user: User, @Query() query: ListApplicationsQueryDto) {
    return {
      success: true,
      ...(await this.applicationsService.listMyApplications(user.id, query)),
    };
  }

  @Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
  @Post()
  createApplication(@CurrentUser() user: User, @Body() dto: CreateApplicationDto) {
    return this.applicationsService.createApplication(user.id, dto);
  }

  /**
   * The merged candidate board: applicants and sourced candidates in one list.
   *
   * Supersedes `for-my-jobs`, which is applicants only and is kept for now
   * because other callers still use it. A sourced card whose application has
   * arrived appears once, as the application.
   */
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Get('pipeline-board')
  async listPipelineBoard(@CurrentUser() user: User, @Query() query: PipelineQueryDto) {
    return { success: true, ...(await this.pipeline.list(user, query)) };
  }

  /** All applicants across the employer's jobs — powers /employers/candidates. */
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Get('for-my-jobs')
  async listApplicantsForMyJobs(@CurrentUser() user: User, @Query() query: ApplicantsQueryDto) {
    return {
      success: true,
      ...(await this.applicationsService.listApplicantsForMyJobs(user, query)),
    };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Get('pipeline/jobs/:jobId')
  async getJobPipeline(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: User,
    @Query() query: ListApplicationsQueryDto,
  ) {
    return {
      success: true,
      ...(await this.applicationsService.getJobPipeline(jobId, user, query)),
    };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @RequiresCapability('candidates:write')
  @Post('pipeline/jobs/:jobId/bulk-update')
  bulkUpdatePipeline(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: User,
    @Body() dto: BulkUpdateApplicationsDto,
  ) {
    return this.applicationsService.bulkUpdateJobApplications(jobId, user, dto);
  }

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return {
      success: true,
      data: await this.applicationsService.getApplicationById(id, user),
    };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @RequiresCapability('candidates:write')
  @Patch(':id/pipeline')
  updatePipeline(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateApplicationPipelineDto,
  ) {
    return this.applicationsService.updateApplicationPipeline(id, user, dto);
  }

  // Same write as `:id/status` below, so the same capability. Without it a
  // Viewer or Interviewer seat could reject an applicant through this path.
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @RequiresCapability('candidates:write')
  @Patch(':id')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.applicationsService.updateApplicationStatus(id, user, dto);
  }

  // Backward-compatible alias.
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @RequiresCapability('candidates:write')
  @Patch(':id/status')
  updateStatusAlias(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.applicationsService.updateApplicationStatus(id, user, dto);
  }

  @Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
  @Post(':id/withdraw')
  withdraw(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.applicationsService.withdrawApplication(id, user);
  }
}
