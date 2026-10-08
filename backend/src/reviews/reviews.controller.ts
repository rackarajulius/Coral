import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/types/user.types';
import { ReviewsService } from './reviews.service';
import {
  CreateReviewDto, FlagReviewDto, ModerateReviewDto, RespondToReviewDto,
} from './dto/review.dto';

/** Candidate side: what you can review, and what you've written. */
@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /**
   * Published reviews for a company. Public — this is what a candidate reads
   * before deciding to apply, so it can't require an account.
   */
  @Public()
  @Get('companies/:employerId')
  async forCompany(@Param('employerId', ParseUUIDPipe) employerId: string) {
    return { success: true, data: await this.reviews.forCompany(employerId) };
  }

  /** Interactions this person could review but hasn't. */
  @Get('reviewable')
  @Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
  async reviewable(@CurrentUser() user: User) {
    return { success: true, data: await this.reviews.reviewable(user) };
  }

  @Get('mine')
  @Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
  async mine(@CurrentUser() user: User) {
    return { success: true, data: await this.reviews.mine(user) };
  }

  /** Writes a review against a verified application or interview. */
  @Post()
  @Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
  async create(@CurrentUser() user: User, @Body() dto: CreateReviewDto) {
    return { success: true, data: await this.reviews.create(user, dto) };
  }

  /** Reports a review. Any signed-in user; resolution is an admin action. */
  @Post(':id/flag')
  async flag(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FlagReviewDto,
  ) {
    return { success: true, data: await this.reviews.flag(user, id, dto) };
  }
}

/** Employer side: read your reviews and reply. No removal path by design. */
@Controller('employers/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class EmployerReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('overview')
  async overview(@CurrentUser() user: User) {
    return { success: true, data: await this.reviews.employerOverview(user) };
  }

  @Get()
  async mine(@CurrentUser() user: User) {
    return { success: true, data: await this.reviews.forEmployer(user) };
  }

  @Post(':id/respond')
  async respond(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondToReviewDto,
  ) {
    return { success: true, data: await this.reviews.respond(user, id, dto) };
  }
}

/** Moderation queue. */
@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('queue')
  async queue() {
    return { success: true, data: await this.reviews.moderationQueue() };
  }

  @Post(':id/moderate')
  async moderate(
    @CurrentUser() admin: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateReviewDto,
  ) {
    return { success: true, data: await this.reviews.moderate(admin, id, dto) };
  }
}
