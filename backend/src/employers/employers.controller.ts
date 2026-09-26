import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/types/user.types';
import {
  CreateEmployerCompanyDto,
  EmployerCompaniesQueryDto,
  UpdateEmployerCompanyDto,
} from './dto/employer-company.dto';
import { AnalyticsEventsService } from '../analytics/analytics-events.service';
import { EmployersService } from './employers.service';
import { NextActionsService } from './next-actions.service';
import { OnboardingService } from './onboarding.service';
import { EmployerVerificationService } from './employer-verification.service';
import { HiringStatsService } from '../analytics/hiring-stats.service';
import { SaveCompanyStepDto } from './dto/onboarding.dto';
import { CompanyCapabilityGuard, RequiresCapability } from '../company/company-capability.guard';

@Controller('employers')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
export class EmployersController {
  constructor(
    private readonly employersService: EmployersService,
    private readonly nextActions: NextActionsService,
    private readonly analyticsEvents: AnalyticsEventsService,
    private readonly onboarding: OnboardingService,
    private readonly verification: EmployerVerificationService,
    private readonly hiringStats: HiringStatsService,
  ) {}

  /**
   * What applying to this company is actually like — public, and the same
   * figures the employer sees for themselves below.
   *
   * Nothing here is opinion: response rate, how long a first answer takes and
   * how many people are left waiting are all measured from the pipeline. Below
   * the sample threshold the service returns `available: false` and the page
   * shows nothing rather than a number built on a handful of applications.
   */
  @Public()
  @Get('companies/:id/hiring-stats')
  async companyHiringStats(@Param('id') id: string) {
    const company = await this.employersService.getCompanyById(id);
    return { success: true, data: await this.hiringStats.forCompany(company.userId) };
  }

  /**
   * The same figures, for the company that owns them.
   *
   * Employers see this before candidates do, so publishing it is an incentive
   * to answer people rather than an ambush.
   */
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Get('me/hiring-stats')
  async myHiringStats(@CurrentUser() user: User) {
    return { success: true, data: await this.hiringStats.forCompany(user.id) };
  }

  /* ── Verification (phase 4) ── */

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Get('me/verification')
  async verificationStatus(@CurrentUser() user: User) {
    return { success: true, data: await this.verification.status(user) };
  }

  /** Instant verification when the work-email domain matches the website. */
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post('me/verification/domain')
  async verifyDomain(@CurrentUser() user: User) {
    return { success: true, data: await this.verification.verifyDomain(user) };
  }

  /* ── Onboarding (phases 1-2) ── */

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Get('me/onboarding')
  async onboardingState(@CurrentUser() user: User) {
    return { success: true, data: await this.onboarding.state(user) };
  }

  /** Companies matching this person's work-email domain. */
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Get('me/onboarding/matches')
  async onboardingMatches(@CurrentUser() user: User) {
    return { success: true, data: await this.onboarding.matches(user) };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post('me/onboarding/company')
  async saveCompanyStep(@CurrentUser() user: User, @Body() dto: SaveCompanyStepDto) {
    return { success: true, data: await this.onboarding.saveCompany(user, dto) };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post('me/onboarding/complete')
  async completeOnboarding(@CurrentUser() user: User) {
    return { success: true, data: await this.onboarding.complete(user) };
  }

  /** Dashboard "Next best actions" — computed from live employer state. */
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Get('me/next-actions')
  async getNextActions(@CurrentUser() user: User) {
    return { success: true, data: await this.nextActions.compute(user) };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Get('me/company')
  async getMyCompany(@CurrentUser() user: User) {
    const company = await this.employersService.getMyCompany(user.id);
    return {
      success: true,
      data: company,
    };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post('companies')
  async createCompany(@CurrentUser() user: User, @Body() dto: CreateEmployerCompanyDto) {
    const company = await this.employersService.createCompany(user.id, dto, user.email);
    return {
      success: true,
      message: 'Company profile created successfully',
      data: company,
    };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @RequiresCapability('company:write')
  @Patch('me/company')
  async updateMyCompany(@CurrentUser() user: User, @Body() dto: UpdateEmployerCompanyDto) {
    const company = await this.employersService.updateMyCompany(user.id, dto);
    return {
      success: true,
      message: 'Company profile updated successfully',
      data: company,
    };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @RequiresCapability('company:write')
  @Post('me/company/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCompanyLogo(
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
    const company = await this.employersService.uploadCompanyLogo(user.id, file);
    return {
      success: true,
      message: 'Logo uploaded successfully',
      data: company,
    };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @RequiresCapability('company:write')
  @Post('me/company/banner')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCompanyBanner(
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
    const company = await this.employersService.uploadCompanyBanner(user.id, file);
    return {
      success: true,
      message: 'Banner uploaded successfully',
      data: company,
    };
  }

  /**
   * Uploads a gallery image or culture video and returns its public URL.
   * `company:write` like the logo and banner beside it — it is the company's
   * public face, and a 50 MB upload is not something every seat should hold.
   */
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @RequiresCapability('company:write')
  @Post('me/company/media')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCompanyMedia(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^(image\/(png|jpe?g|webp)|video\/(mp4|webm|quicktime))$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const data = await this.employersService.uploadCompanyMedia(user.id, file);
    return {
      success: true,
      message: 'Media uploaded successfully',
      data,
    };
  }

  @Public()
  @Get('companies')
  async listCompanies(@Query() query: EmployerCompaniesQueryDto) {
    const companies = await this.employersService.listCompanies(query);
    return {
      success: true,
      ...companies,
    };
  }

  @Public()
  @Get('companies/:id')
  async getCompanyById(@Param('id') id: string, @Req() req: Request) {
    const company = await this.employersService.getCompanyById(id);

    // `id` may be a slug or a profile id, so attribute to the owning user the
    // service resolved — never to the raw path parameter.
    const ownerId = (company as { userId?: string })?.userId;
    if (ownerId) {
      this.analyticsEvents.record({
        type: 'profile_view',
        employerId: ownerId,
        viewerId: (req as Request & { user?: { id?: string } }).user?.id ?? null,
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
        userAgent: req.headers['user-agent'] ?? null,
        referer: (req.headers.referer as string) ?? null,
      });
    }

    return {
      success: true,
      data: company,
    };
  }

  @Public()
  @Get('companies/:id/similar')
  async getSimilarCompanies(@Param('id') id: string) {
    const data = await this.employersService.getSimilarCompanies(id);
    return {
      success: true,
      data,
    };
  }

  /** Whether the current user follows this company (+ total follower count). Any authenticated user. */
  @Get('companies/:id/follow')
  async getFollowStatus(@CurrentUser() user: User, @Param('id') id: string) {
    const data = await this.employersService.getFollowStatus(user.id, id);
    return { success: true, data };
  }

  /** Follow a company. Any authenticated user. */
  @Post('companies/:id/follow')
  async followCompany(@CurrentUser() user: User, @Param('id') id: string) {
    const data = await this.employersService.followCompany(user.id, id);
    return { success: true, data };
  }

  /** Unfollow a company. Any authenticated user. */
  @Delete('companies/:id/follow')
  async unfollowCompany(@CurrentUser() user: User, @Param('id') id: string) {
    const data = await this.employersService.unfollowCompany(user.id, id);
    return { success: true, data };
  }
}

