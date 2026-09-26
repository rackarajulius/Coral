import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { ModerationService, REPORT_REASONS, type ReportReason } from './moderation.service';

export class ReportDto {
  @IsIn(REPORT_REASONS as unknown as string[])
  reason!: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  detail?: string;
}

export class RemovalDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class DismissDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolution?: string;
}

export class ReportQueryDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;
}

/**
 * Reporting is open to any signed-in member; acting on reports is not.
 *
 * Both live on one controller because they are one workflow — separating them
 * tends to produce a reporting form that nothing reads.
 */
@Controller('community/moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  /** The closed list of reasons, served so the UI cannot offer one we reject. */
  @Get('reasons')
  reasons() {
    return { success: true, data: { reasons: REPORT_REASONS } };
  }

  @Post('posts/:id/report')
  async reportPost(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportDto,
  ) {
    return { success: true, data: await this.moderation.reportPost(user, id, dto.reason, dto.detail) };
  }

  @Post('comments/:id/report')
  async reportComment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportDto,
  ) {
    return {
      success: true,
      data: await this.moderation.reportComment(user, id, dto.reason, dto.detail),
    };
  }

  @Get('reports')
  async listReports(@CurrentUser() user: User, @Query() query: ReportQueryDto) {
    return { success: true, data: await this.moderation.listReports(user, query.status) };
  }

  @Post('posts/:id/remove')
  async removePost(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemovalDto,
  ) {
    return { success: true, data: await this.moderation.removePost(user, id, dto.reason) };
  }

  @Post('posts/:id/restore')
  async restorePost(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.moderation.restorePost(user, id) };
  }

  @Post('comments/:id/remove')
  async removeComment(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.moderation.removeComment(user, id) };
  }

  @Post('reports/:id/dismiss')
  async dismiss(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DismissDto,
  ) {
    return { success: true, data: await this.moderation.dismissReport(user, id, dto.resolution) };
  }
}
