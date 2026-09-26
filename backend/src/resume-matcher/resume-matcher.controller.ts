import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { ResumeMatcherService } from './resume-matcher.service';
import { SeekerEntitlementsService } from '../seeker-entitlements/seeker-entitlements.service';
import { CompanyResearchService } from './company-research/company-research.service';
import { RunMatchDto } from './dto/run-match.dto';
import { AssistDto } from './dto/assist.dto';
import { CompanyResearchDto } from './dto/company-research.dto';

@Controller('resume-matcher')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
export class ResumeMatcherController {
  constructor(
    private readonly service: ResumeMatcherService,
    private readonly companyResearch: CompanyResearchService,
    private readonly entitlements: SeekerEntitlementsService,
  ) {}

  /** Any signed-in job seeker can check access — the UI uses it to show the upsell. */
  @Get('access')
  getAccess(@CurrentUser() user: User) {
    return { success: true, data: this.service.getAccess(user) };
  }

  /**
   * Open to every job seeker: platform matches are part of the free tier, and
   * the service decides whether web sources join.
   */
  @Post('run')
  async run(@CurrentUser() user: User, @Body() dto: RunMatchDto) {
    return { success: true, data: await this.service.run(user, dto) };
  }

  /**
   * Draft a cover letter for a specific job.
   *
   * Checked against the allowance rather than a plain Premium flag: Premium
   * also has a monthly fair-use cap, which a tier check alone can't see.
   */
  @Post('cover-letter')
  async coverLetter(@CurrentUser() user: User, @Body() dto: AssistDto) {
    await this.entitlements.assertAllowed(user, 'assist.cover_letter');
    const data = await this.service.coverLetter(user, dto);
    // Counted after it succeeds: a failed draft is not a used one.
    await this.entitlements.record(user.id, 'assist.cover_letter');
    return { success: true, data };
  }

  /** Tailor the resume to a specific job. */
  @Post('tailor')
  async tailor(@CurrentUser() user: User, @Body() dto: AssistDto) {
    await this.entitlements.assertAllowed(user, 'assist.tailor');
    const data = await this.service.tailor(user, dto);
    await this.entitlements.record(user.id, 'assist.tailor');
    return { success: true, data };
  }

  /** Research the company behind a listing (real web sources). */
  @Post('company-research')
  async researchCompany(@CurrentUser() user: User, @Body() dto: CompanyResearchDto) {
    await this.entitlements.assertAllowed(user, 'research.company');
    const data = await this.companyResearch.research(dto.company, dto.jobTitle);
    // Only a real lookup counts. With no research provider configured the
    // feature returned nothing, and nothing was used.
    if (data.configured && data.profile) await this.entitlements.record(user.id, 'research.company');
    return { success: true, data };
  }
}
