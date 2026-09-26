import { Module } from '@nestjs/common';
import { EmailModule } from '../services/email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingModule } from '../billing/billing.module';
import { EmployerRecommendationsController, RecommendationsController } from './recommendations.controller';
import { JobRecommendationsService } from './job-recommendations.service';
import { JobFanoutService } from './job-fanout.service';
import { JobBoostService } from './job-boost.service';
import { RecommendationStatsService } from './recommendation-stats.service';

/**
 * Jobs → the seekers they suit: the feed, the publish fan-out and digest, paid
 * boosts, and the reach figures employers see. The rules that decide a match
 * are in job-match.rules.ts, and nothing else decides one.
 */
@Module({
  imports: [EmailModule, NotificationsModule, BillingModule],
  controllers: [RecommendationsController, EmployerRecommendationsController],
  providers: [JobRecommendationsService, JobFanoutService, JobBoostService, RecommendationStatsService],
})
export class RecommendationsModule {}
