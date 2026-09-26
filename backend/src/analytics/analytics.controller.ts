import {
  Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/types/user.types';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEventsService, type AnalyticsEventType } from './analytics-events.service';
import { EmployerAnalyticsService } from './employer-analytics.service';
import { InsightsService } from './insights.service';
import { BrandScoreService } from './brand-score.service';
import { CompetitorInsightsService } from './competitor-insights.service';
import { countryFromRequest, sanitizeTimezone } from './geo';
import { TrackEventDto } from './dto/track-event.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('me')
  async getMyAnalytics(@CurrentUser() user: User) {
    return {
      success: true,
      data: await this.analyticsService.getMyAnalytics(user),
    };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Get('jobs/:id')
  async getJobAnalytics(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return {
      success: true,
      data: await this.analyticsService.getJobAnalytics(id, user),
    };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Get('companies/:id')
  async getCompanyAnalytics(@Param('id') id: string, @CurrentUser() user: User) {
    return {
      success: true,
      data: await this.analyticsService.getCompanyAnalytics(id, user),
    };
  }
}

/** Employer analytics reads. Everything is scoped to the caller's own data. */
@Controller('analytics/employer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class EmployerAnalyticsController {
  constructor(
    private readonly employerAnalytics: EmployerAnalyticsService,
    private readonly insightsService: InsightsService,
    private readonly brandScoreService: BrandScoreService,
    private readonly competitorInsights: CompetitorInsightsService,
  ) {}

  /** Clamped so a caller can't request an unbounded scan. */
  private range(raw?: string): number {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 365) : 30;
  }

  @Get('overview')
  async overview(@CurrentUser() user: User, @Query('days') days?: string) {
    return { success: true, data: await this.employerAnalytics.overview(user, this.range(days)) };
  }

  @Get('funnel')
  async funnel(
    @CurrentUser() user: User,
    @Query('days') days?: string,
    @Query('jobId') jobId?: string,
  ) {
    return {
      success: true,
      data: await this.employerAnalytics.funnel(user, this.range(days), jobId),
    };
  }

  @Get('jobs')
  async jobs(@CurrentUser() user: User, @Query('days') days?: string) {
    return { success: true, data: await this.employerAnalytics.jobs(user, this.range(days)) };
  }

  /** Deterministic, checkable insights — no model, no confidence score. */
  @Get('insights')
  async insights(@CurrentUser() user: User) {
    return { success: true, data: await this.insightsService.forEmployer(user) };
  }

  /** Where visitors came from, by channel. Counts sessions, not events. */
  @Get('sources')
  async sources(@CurrentUser() user: User, @Query('days') days?: string) {
    return { success: true, data: await this.employerAnalytics.sources(user, this.range(days)) };
  }

  /** Visitor regions. Says which source the numbers came from. */
  @Get('geo')
  async geo(@CurrentUser() user: User, @Query('days') days?: string) {
    return { success: true, data: await this.employerAnalytics.geo(user, this.range(days)) };
  }

  /** Employer-brand KPIs. Only the ones with a real source. */
  @Get('brand')
  async brand(@CurrentUser() user: User, @Query('days') days?: string) {
    return { success: true, data: await this.employerAnalytics.brand(user, this.range(days)) };
  }

  /** Brand score — a checklist, with the full breakdown. */
  @Get('brand-score')
  async brandScore(@CurrentUser() user: User) {
    return { success: true, data: await this.brandScoreService.forEmployer(user) };
  }

  /** Other companies on Coral with live posts like yours. Rule-matched, platform-only. */
  @Get('competitors')
  async competitors(@CurrentUser() user: User) {
    return { success: true, data: await this.competitorInsights.forEmployer(user) };
  }

  @Get('talent')
  async talent(@CurrentUser() user: User) {
    return { success: true, data: await this.employerAnalytics.talent(user) };
  }
}

/**
 * A country hint for forms that ask where someone is.
 *
 * Onboarding used to call ipapi.co straight from the browser to prefill the
 * location field. That leaked every visitor's IP to a third party with no
 * consent, was blocked by CORS anyway, and contradicted the decision recorded
 * in `geo.ts`: no GeoIP database, no lookup API — that is a purchasing
 * decision, not something to slip in.
 *
 * This uses what the edge already resolved, for free, and stores nothing. It
 * answers with `null` when not deployed behind a CDN (local development, for
 * one), and the form simply stays empty — which is the honest state, rather
 * than a guessed city that quietly becomes someone's profile location.
 */
@Controller('geo')
export class GeoHintController {
  @Public()
  @Get('hint')
  hint(@Req() req: Request) {
    return { success: true, data: { country: countryFromRequest(req) } };
  }
}

/**
 * Event ingest.
 *
 * Public because most of what it measures happens before anyone signs in — a
 * candidate browsing jobs is exactly the traffic the funnel is about. Its own
 * controller so the auth-guarded analytics reads above stay guarded.
 */
@Controller('analytics/events')
export class AnalyticsIngestController {
  constructor(
    private readonly events: AnalyticsEventsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Always 202, whatever happens. A tracking pixel must not tell a caller
   * whether a job exists, whether their event was accepted, or whether it was
   * de-duplicated — those replies are a probing oracle, and the browser has
   * nothing useful to do with the answer either way.
   */
  @Public()
  @Post()
  @HttpCode(202)
  async track(@Body() dto: TrackEventDto, @Req() req: Request) {
    try {
      const employerId = await this.resolveEmployer(dto);
      if (employerId) {
        this.events.record({
          type: dto.type as AnalyticsEventType,
          employerId,
          jobId: dto.jobId ?? null,
          // Present only when the request carried a valid token; the global
          // guard populates it for public routes too when one is supplied.
          viewerId: (req as Request & { user?: { id?: string } }).user?.id ?? null,
          ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
          userAgent: req.headers['user-agent'] ?? null,
          referer: (req.headers.referer as string) ?? null,
          referrerOverride: dto.referrer ?? null,
          // Resolved from the edge header — the IP itself is never stored.
          country: countryFromRequest(req),
          timezone: sanitizeTimezone(dto.timezone),
          utmSource: dto.utmSource ?? null,
          utmMedium: dto.utmMedium ?? null,
          utmCampaign: dto.utmCampaign ?? null,
        });
      }
    } catch {
      // Swallowed deliberately — see the note above.
    }
    return { success: true };
  }

  /**
   * Whose numbers this event belongs to, derived from the thing being viewed.
   * Returns null when the target doesn't exist, so junk is dropped rather than
   * attributed to someone.
   */
  private async resolveEmployer(dto: TrackEventDto): Promise<string | null> {
    if (dto.jobId) {
      const job = await this.prisma.job.findUnique({
        where: { id: dto.jobId },
        select: { postedById: true },
      });
      return job?.postedById ?? null;
    }
    if (dto.companyUserId) {
      const profile = await this.prisma.employerProfile.findUnique({
        where: { userId: dto.companyUserId },
        select: { userId: true },
      });
      return profile?.userId ?? null;
    }
    return null;
  }
}
