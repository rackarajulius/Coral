import { Module } from '@nestjs/common';
import {
  AnalyticsController, AnalyticsIngestController, EmployerAnalyticsController, GeoHintController,
} from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEventsService } from './analytics-events.service';
import { EmployerAnalyticsService } from './employer-analytics.service';
import { BrandScoreService } from './brand-score.service';
import { InsightsService } from './insights.service';
import { HiringStatsService } from './hiring-stats.service';
import { HiringCommitmentsService } from './hiring-commitments.service';
import { CompetitorInsightsService } from './competitor-insights.service';

@Module({
  controllers: [
    AnalyticsController, AnalyticsIngestController, EmployerAnalyticsController,
    // Not analytics as such, but it reuses the same edge-header geo helper.
    GeoHintController,
  ],
  providers: [
    AnalyticsService, AnalyticsEventsService, EmployerAnalyticsService, InsightsService, BrandScoreService,
    HiringStatsService, HiringCommitmentsService, CompetitorInsightsService,
  ],
  // Exported so server-side call sites (job page reads) can record directly,
  // without a round trip through the browser.
  exports: [AnalyticsService, AnalyticsEventsService, HiringStatsService, HiringCommitmentsService],
})
export class AnalyticsModule {}
