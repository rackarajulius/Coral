import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/user.types';
import { PostStatsService } from './post-stats.service';

export class RecordViewsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  postIds!: string[];
}

/** Views, and the numbers built from them. Signed in only: views are counted per person. */
@Controller('community')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PostStatsController {
  constructor(private readonly stats: PostStatsService) {}

  /** Posts the reader had on screen, sent in batches from the feed. */
  @Post('post-views')
  async record(@CurrentUser() user: User, @Body() dto: RecordViewsDto) {
    return { success: true, data: await this.stats.recordViews(user, dto.postIds) };
  }

  /** Someone pressed the post's call-to-action button; counted once per person per day. */
  @Post('posts/:id/cta-click')
  async ctaClick(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.stats.recordCtaClick(user, id) };
  }

  /** One post's numbers, for its author or its company's page admins. */
  @Get('posts/:id/stats')
  async post(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.stats.postStats(user, id) };
  }

  /** A company page's recent numbers; null data for anyone who does not run it. */
  @Get('company-pages/:companyId/insights')
  async company(
    @CurrentUser() user: User,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('days') days?: string,
  ) {
    return { success: true, data: await this.stats.companyInsights(user, companyId, days ? Number(days) || 30 : 30) };
  }
}
