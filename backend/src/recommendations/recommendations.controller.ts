import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { CompanyCapabilityGuard, RequiresCapability } from '../company/company-capability.guard';
import { JobRecommendationsService } from './job-recommendations.service';
import { JobBoostService } from './job-boost.service';
import { RecommendationStatsService } from './recommendation-stats.service';

/** A job seeker's own recommendations. */
@Controller('recommendations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JOB_SEEKER)
export class RecommendationsController {
  constructor(private readonly recommendations: JobRecommendationsService) {}

  @Get('jobs')
  async jobs(@CurrentUser() user: User, @Query('limit') limit?: string) {
    const n = Number(limit);
    const data = await this.recommendations.forSeeker(user, Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 10);
    return { success: true, data };
  }

  @Post('jobs/:jobId/opened')
  @HttpCode(204)
  async opened(@CurrentUser() user: User, @Param('jobId', ParseUUIDPipe) jobId: string) {
    await this.recommendations.markOpened(user, jobId);
  }

  @Post('jobs/:jobId/dismiss')
  @HttpCode(204)
  async dismiss(@CurrentUser() user: User, @Param('jobId', ParseUUIDPipe) jobId: string) {
    await this.recommendations.dismiss(user, jobId);
  }

  @Delete('jobs/:jobId/dismiss')
  @HttpCode(204)
  async undismiss(@CurrentUser() user: User, @Param('jobId', ParseUUIDPipe) jobId: string) {
    await this.recommendations.undismiss(user, jobId);
  }
}

/** Reach and boosts, for the company that posted the jobs. */
@Controller('employers/recommendations')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class EmployerRecommendationsController {
  constructor(
    private readonly stats: RecommendationStatsService,
    private readonly boosts: JobBoostService,
  ) {}

  /** Per job: delivered, opened, applied — and any boost. */
  @Get('reach')
  @RequiresCapability('jobs:read')
  async reach(@CurrentUser() user: User) {
    return { success: true, data: await this.stats.forEmployer(user) };
  }

  @Get('boosts/allowance')
  @RequiresCapability('jobs:read')
  async allowance(@CurrentUser() user: User) {
    return { success: true, data: await this.boosts.allowance(user) };
  }

  /**
   * Starts a boost. Takes a job id and nothing else — there is deliberately no
   * way to say who should see it.
   */
  @Post('jobs/:jobId/boost')
  @RequiresCapability('jobs:write')
  async boost(@CurrentUser() user: User, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return { success: true, data: await this.boosts.start(user, jobId) };
  }

  @Post('boosts/:id/end')
  @RequiresCapability('jobs:write')
  async end(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.boosts.end(user, id) };
  }
}
