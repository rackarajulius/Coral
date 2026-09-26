import { Body, Controller, Delete, Get, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { FairnessService } from './fairness.service';
import {
  AGE_BAND_OPTIONS, DISABILITY_OPTIONS, ETHNICITY_OPTIONS, GENDER_OPTIONS,
  UpsertDemographicReportDto, VETERAN_OPTIONS,
} from './dto/demographic-report.dto';

/**
 * A candidate's own demographic self-report.
 *
 * Only the person who submitted it can read it back. There is no endpoint that
 * returns anyone else's — not for employers, not for admins. The admin side
 * gets aggregates only.
 */
@Controller('me/demographics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JOB_SEEKER, UserRole.FREELANCER, UserRole.ADMIN)
export class MyDemographicsController {
  constructor(private readonly fairness: FairnessService) {}

  /** The option lists, so the form and the validator can't drift apart. */
  @Get('options')
  options() {
    return {
      success: true,
      data: {
        ethnicity: ETHNICITY_OPTIONS,
        gender: GENDER_OPTIONS,
        ageBand: AGE_BAND_OPTIONS,
        disability: DISABILITY_OPTIONS,
        veteran: VETERAN_OPTIONS,
      },
    };
  }

  @Get()
  async mine(@CurrentUser() user: User) {
    return { success: true, data: await this.fairness.getMine(user) };
  }

  @Put()
  async save(@CurrentUser() user: User, @Body() dto: UpsertDemographicReportDto) {
    return { success: true, data: await this.fairness.upsertMine(user, dto) };
  }

  @Delete()
  async remove(@CurrentUser() user: User) {
    return { success: true, data: await this.fairness.deleteMine(user) };
  }
}

/** Aggregate fairness monitoring of the AI screening scorer. Admin only. */
@Controller('admin/fairness')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminFairnessController {
  constructor(private readonly fairness: FairnessService) {}

  /**
   * Score and advance rates by group, with the four-fifths impact ratio.
   * Groups below the minimum size are suppressed, not shown.
   */
  @Get('adverse-impact')
  async adverseImpact(@Query('jobId') jobId?: string) {
    return { success: true, data: await this.fairness.adverseImpact({ jobId }) };
  }

  /** Who job recommendations reach, by self-reported group. Same suppression rules. */
  @Get('recommendation-reach')
  async recommendationReach(@Query('days') days?: string) {
    const n = Number(days);
    return {
      success: true,
      data: await this.fairness.recommendationReach({ days: Number.isFinite(n) ? n : undefined }),
    };
  }
}
