import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  ParseUUIDPipe,
  Param,
  Patch,
  Put,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/types/user.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateCertificationDto, UpdateCertificationDto } from './dto/certification.dto';
import { CreateEducationDto, UpdateEducationDto } from './dto/education.dto';
import { CreateExperienceDto, UpdateExperienceDto } from './dto/experience.dto';
import { CreatePortfolioItemDto, UpdatePortfolioItemDto } from './dto/portfolio.dto';
import { CreateRecommendationDto, UpdateRecommendationDto } from './dto/recommendation.dto';
import {
  GenerateInterviewPrepDto,
  InterviewPrepFeedbackDto,
  InterviewPrepSessionsQueryDto,
} from './dto/interview-prep.dto';
import { AddSkillsDto } from './dto/skills.dto';
import { AnalyzeReadinessDto } from './dto/analyze-readiness.dto';
import { SuggestHeadlinesDto } from './dto/suggest-headlines.dto';
import { UpdateJobSeekerProfileDto } from './dto/update-job-seeker-profile.dto';
import { JobSeekersService } from './job-seekers.service';
import { ResumeFileValidator } from '../common/pipes/resume-file.validator';
import {
  ProfileImpressionsService,
  VIEW_VISIBILITIES,
  ViewVisibility,
  defaultVisibilityFor,
} from './profile-impressions.service';

/** The three ways a viewer can appear to the person they looked at. */
/** The seeker's own browser timezone (IANA, e.g. "America/Toronto"). */
export class TimezoneDto {
  @IsString()
  @MaxLength(64)
  timezone!: string;
}

export class ViewVisibilityDto {
  @IsIn(VIEW_VISIBILITIES)
  visibility!: ViewVisibility;
}

@Controller('job-seekers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
export class JobSeekersController {
  constructor(
    private readonly jobSeekersService: JobSeekersService,
    private readonly impressions: ProfileImpressionsService,
  ) {}

  @Get('me/profile')
  async getMyProfile(@CurrentUser() user: User) {
    const profile = await this.jobSeekersService.getMyProfile(user.id);
    return {
      success: true,
      data: profile,
    };
  }

  /**
   * Read-only public profile of another job seeker (recruiter view / shared
   * link). Method-level roles override the class default so employers can view;
   * privacy gating happens in the service.
   */
  @Roles(UserRole.JOB_SEEKER, UserRole.FREELANCER, UserRole.EMPLOYER, UserRole.ADMIN)
  @Get(':id/public-profile')
  async getPublicProfile(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return {
      success: true,
      data: await this.jobSeekersService.getPublicProfile(id, user),
    };
  }

  /**
   * What the profile reports about itself: views and search appearances in the
   * last 90 days. Own data only — there is no way to ask about anyone else.
   */
  @Get('me/profile-stats')
  async profileStats(@CurrentUser() user: User) {
    return { success: true, data: await this.impressions.statsFor(user.id) };
  }

  /**
   * Who viewed you, as far as each viewer allowed. Locked when the caller
   * themselves browses privately — the trade is symmetrical.
   */
  @Get('me/profile-viewers')
  async profileViewers(@CurrentUser() user: User) {
    return { success: true, data: await this.impressions.viewersFor(user) };
  }

  /** The caller's own browsing visibility, and what it means. */
  @Roles(UserRole.JOB_SEEKER, UserRole.EMPLOYER, UserRole.ADMIN)
  @Get('me/view-visibility')
  async getViewVisibility(@CurrentUser() user: User) {
    return {
      success: true,
      data: {
        visibility: await this.impressions.visibilityOf(user.id, user.role),
        /** So the client never has to guess what "unset" means for this role. */
        roleDefault: defaultVisibilityFor(user.role),
      },
    };
  }

  /**
   * Records the timezone the seeker's browser reports, so an outreach message
   * can be suggested for their working hours rather than the recruiter's.
   * Sent by the app once a session; an invalid zone is ignored, not stored.
   */
  @Roles(UserRole.JOB_SEEKER)
  @Put('me/timezone')
  async setTimezone(@CurrentUser() user: User, @Body() dto: TimezoneDto) {
    return { success: true, data: await this.jobSeekersService.setTimezone(user.id, dto.timezone) };
  }

  /** Applies to future views only; past rows keep the choice made at the time. */
  @Roles(UserRole.JOB_SEEKER, UserRole.EMPLOYER, UserRole.ADMIN)
  @Patch('me/view-visibility')
  async setViewVisibility(@CurrentUser() user: User, @Body() dto: ViewVisibilityDto) {
    return { success: true, data: await this.impressions.setVisibility(user.id, dto.visibility) };
  }

  @Post('me/headline/suggestions')
  async suggestHeadlines(@CurrentUser() user: User, @Body() dto: SuggestHeadlinesDto) {
    const result = await this.jobSeekersService.suggestHeadlines(user.id, dto.targetRole);
    return {
      success: true,
      message: 'Headline suggestions generated',
      data: result,
    };
  }

  @Post('me/readiness/analyze')
  async analyzeRoleReadiness(@CurrentUser() user: User, @Body() dto: AnalyzeReadinessDto) {
    const result = await this.jobSeekersService.analyzeRoleReadiness(user.id, dto.targetRole);
    return {
      success: true,
      message: 'Role readiness analyzed',
      data: result,
    };
  }

  @Post('me/interview-prep/sessions/generate')
  async generateInterviewPrep(
    @CurrentUser() user: User,
    @Body() dto: GenerateInterviewPrepDto,
  ) {
    const session = await this.jobSeekersService.generateInterviewPrepSession(user.id, dto);
    return {
      success: true,
      message: 'Interview prep generated successfully',
      data: session,
    };
  }

  @Get('me/interview-prep/sessions')
  async listInterviewPrepSessions(
    @CurrentUser() user: User,
    @Query() query: InterviewPrepSessionsQueryDto,
  ) {
    const sessions = await this.jobSeekersService.listInterviewPrepSessions(user.id, query);
    return {
      success: true,
      ...sessions,
    };
  }

  @Get('me/interview-prep/sessions/:id')
  async getInterviewPrepSession(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const session = await this.jobSeekersService.getInterviewPrepSession(user.id, id);
    return {
      success: true,
      data: session,
    };
  }

  @Post('me/interview-prep/sessions/:id/feedback')
  async evaluateInterviewAnswer(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InterviewPrepFeedbackDto,
  ) {
    const feedback = await this.jobSeekersService.evaluateInterviewAnswer(user.id, id, dto);
    return {
      success: true,
      message: 'Interview answer feedback generated successfully',
      data: feedback,
    };
  }

  @Patch('me/profile')
  async updateMyProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateJobSeekerProfileDto,
  ) {
    const profile = await this.jobSeekersService.updateMyProfile(user.id, dto);
    return {
      success: true,
      message: 'Job seeker profile updated successfully',
      data: profile,
    };
  }

  /** The signed-in user's stored resume + a short-lived download URL. */
  @Get('me/resume')
  async getMyResume(@CurrentUser() user: User) {
    return { success: true, data: await this.jobSeekersService.getMyResume(user.id) };
  }

  @Delete('me/resume')
  async deleteMyResume(@CurrentUser() user: User) {
    return { success: true, data: await this.jobSeekersService.deleteMyResume(user.id) };
  }

  /**
   * Uploads a resume tailored to one application. Unlike `me/resume/parse`,
   * this does NOT change the profile default — the returned path is passed to
   * the apply call for that job only.
   */
  @Post('me/resume/for-application')
  @UseInterceptors(FileInterceptor('file'))
  async uploadResumeForApplication(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          // Checks the bytes, and can actually accept a .txt — see the
          // validator for why Nest's own one cannot.
          new ResumeFileValidator(),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return {
      success: true,
      data: await this.jobSeekersService.uploadResumeForApplication(user.id, file),
    };
  }

  @Post('me/resume/parse')
  @UseInterceptors(FileInterceptor('file'))
  async parseResume(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          // Checks the bytes, and can actually accept a .txt — see the
          // validator for why Nest's own one cannot.
          new ResumeFileValidator(),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    const parsed = await this.jobSeekersService.parseResume(file, user.id);
    return {
      success: true,
      message: 'Resume parsed successfully',
      data: parsed,
    };
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(png|jpe?g|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const profile = await this.jobSeekersService.uploadAvatar(user.id, file);
    return {
      success: true,
      message: 'Profile photo uploaded successfully',
      data: { avatarUrl: profile.avatarUrl },
    };
  }

  @Delete('me/avatar')
  async deleteAvatar(@CurrentUser() user: User) {
    await this.jobSeekersService.deleteAvatar(user.id);
    return {
      success: true,
      message: 'Profile photo removed',
    };
  }

  @Post('me/banner')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBanner(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(png|jpe?g|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const profile = await this.jobSeekersService.uploadBanner(user.id, file);
    return {
      success: true,
      message: 'Banner uploaded successfully',
      data: { bannerUrl: profile.bannerUrl },
    };
  }

  @Delete('me/banner')
  async deleteBanner(@CurrentUser() user: User) {
    await this.jobSeekersService.deleteBanner(user.id);
    return {
      success: true,
      message: 'Banner removed',
    };
  }

  @Post('me/intro-video')
  @UseInterceptors(FileInterceptor('file'))
  async uploadIntroVideo(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^video\/(mp4|webm|quicktime)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const profile = await this.jobSeekersService.uploadIntroVideo(user.id, file);
    return {
      success: true,
      message: 'Intro video uploaded successfully',
      data: { introVideoUrl: profile.introVideoUrl },
    };
  }

  @Post('me/experiences')
  async addExperience(@CurrentUser() user: User, @Body() dto: CreateExperienceDto) {
    const experience = await this.jobSeekersService.addExperience(user.id, dto);
    return {
      success: true,
      message: 'Experience added successfully',
      data: experience,
    };
  }

  @Patch('me/experiences/:id')
  async updateExperience(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExperienceDto,
  ) {
    const experience = await this.jobSeekersService.updateExperience(user.id, id, dto);
    return {
      success: true,
      message: 'Experience updated successfully',
      data: experience,
    };
  }

  @Delete('me/experiences/:id')
  async deleteExperience(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.jobSeekersService.deleteExperience(user.id, id);
    return {
      success: true,
      message: 'Experience deleted successfully',
    };
  }

  @Post('me/educations')
  async addEducation(@CurrentUser() user: User, @Body() dto: CreateEducationDto) {
    const education = await this.jobSeekersService.addEducation(user.id, dto);
    return {
      success: true,
      message: 'Education added successfully',
      data: education,
    };
  }

  @Patch('me/educations/:id')
  async updateEducation(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEducationDto,
  ) {
    const education = await this.jobSeekersService.updateEducation(user.id, id, dto);
    return {
      success: true,
      message: 'Education updated successfully',
      data: education,
    };
  }

  @Delete('me/educations/:id')
  async deleteEducation(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.jobSeekersService.deleteEducation(user.id, id);
    return {
      success: true,
      message: 'Education deleted successfully',
    };
  }

  @Post('me/certifications')
  async addCertification(@CurrentUser() user: User, @Body() dto: CreateCertificationDto) {
    const certification = await this.jobSeekersService.addCertification(user.id, dto);
    return {
      success: true,
      message: 'Certification added successfully',
      data: certification,
    };
  }

  @Patch('me/certifications/:id')
  async updateCertification(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCertificationDto,
  ) {
    const certification = await this.jobSeekersService.updateCertification(user.id, id, dto);
    return {
      success: true,
      message: 'Certification updated successfully',
      data: certification,
    };
  }

  @Delete('me/certifications/:id')
  async deleteCertification(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.jobSeekersService.deleteCertification(user.id, id);
    return {
      success: true,
      message: 'Certification deleted successfully',
    };
  }

  @Post('me/skills')
  async addSkills(@CurrentUser() user: User, @Body() dto: AddSkillsDto) {
    const profile = await this.jobSeekersService.addSkills(user.id, dto.skills);
    return {
      success: true,
      message: 'Skills updated successfully',
      data: profile,
    };
  }

  @Delete('me/skills/:id')
  async removeSkill(@CurrentUser() user: User, @Param('id') id: string) {
    const profile = await this.jobSeekersService.removeSkill(user.id, id);
    return {
      success: true,
      message: 'Skill removed successfully',
      data: profile,
    };
  }

  /** Stores a Featured item's image and returns its URL; the item keeps the URL. */
  @Post('me/portfolio/image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPortfolioImage(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(png|jpe?g|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const imageUrl = await this.jobSeekersService.uploadPortfolioImage(user.id, file);
    return {
      success: true,
      message: 'Image uploaded successfully',
      data: { imageUrl },
    };
  }

  @Post('me/portfolio')
  async addPortfolioItem(@CurrentUser() user: User, @Body() dto: CreatePortfolioItemDto) {
    const item = await this.jobSeekersService.addPortfolioItem(user.id, dto);
    return {
      success: true,
      message: 'Portfolio item added successfully',
      data: item,
    };
  }

  @Patch('me/portfolio/:id')
  async updatePortfolioItem(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePortfolioItemDto,
  ) {
    const item = await this.jobSeekersService.updatePortfolioItem(user.id, id, dto);
    return {
      success: true,
      message: 'Portfolio item updated successfully',
      data: item,
    };
  }

  @Delete('me/portfolio/:id')
  async deletePortfolioItem(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.jobSeekersService.deletePortfolioItem(user.id, id);
    return {
      success: true,
      message: 'Portfolio item deleted successfully',
    };
  }

  @Post('me/recommendations')
  async addRecommendation(@CurrentUser() user: User, @Body() dto: CreateRecommendationDto) {
    const recommendation = await this.jobSeekersService.addRecommendation(user.id, dto);
    return {
      success: true,
      message: 'Recommendation added successfully',
      data: recommendation,
    };
  }

  @Patch('me/recommendations/:id')
  async updateRecommendation(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecommendationDto,
  ) {
    const recommendation = await this.jobSeekersService.updateRecommendation(user.id, id, dto);
    return {
      success: true,
      message: 'Recommendation updated successfully',
      data: recommendation,
    };
  }

  @Delete('me/recommendations/:id')
  async deleteRecommendation(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.jobSeekersService.deleteRecommendation(user.id, id);
    return {
      success: true,
      message: 'Recommendation deleted successfully',
    };
  }
}
