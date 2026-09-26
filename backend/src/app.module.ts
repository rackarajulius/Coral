import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { CompanyModule } from './company/company.module';
import { AutomationsModule } from './automations/automations.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { JobSeekersModule } from './job-seekers/job-seekers.module';
import { EmployersModule } from './employers/employers.module';
import { FreelancersModule } from './freelancers/freelancers.module';
import { JobsModule } from './jobs/jobs.module';
import { GigsModule } from './gigs/gigs.module';
import { CommunityModule } from './community/community.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AppConfigModule } from './config/config.module';
import { ElasticsearchModule } from './services/elasticsearch/elasticsearch.module';
import { RedisModule } from './services/redis/redis.module';
import { QueueModule } from './services/queue/queue.module';
import { ApplicationsModule } from './applications/applications.module';
import { ContractsModule } from './contracts/contracts.module';
import { PaymentsModule } from './payments/payments.module';
import { BillingModule } from './billing/billing.module';
import { AtsModule } from './ats/ats.module';
import { DistributionModule } from './distribution/distribution.module';
import { SavedJobsModule } from './saved-jobs/saved-jobs.module';
import { JobAlertsModule } from './job-alerts/job-alerts.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { SchedulingModule } from './common/scheduling/scheduling.module';
import { SearchModule } from './search/search.module';
import { StorageModule } from './storage/storage.module';
import { AdminModule } from './admin/admin.module';
import { VerificationsModule } from './verifications/verifications.module';
import { ResumeMatcherModule } from './resume-matcher/resume-matcher.module';
import { HiringModule } from './employer-hiring/hiring.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { MessagingModule } from './messaging/messaging.module';
import { InterviewCoachModule } from './interview-coach/interview-coach.module';
import { SeekerEntitlementsModule } from './seeker-entitlements/seeker-entitlements.module';
import { SeekerBillingModule } from './seeker-billing/seeker-billing.module';
import { FairnessModule } from './fairness/fairness.module';
import { ReviewsModule } from './reviews/reviews.module';

@Module({
  imports: [
    // Configuration
    AppConfigModule,

    // Scheduling (cron jobs)
    ScheduleModule.forRoot(),

    // Database
    PrismaModule,
    CompanyModule,
    AutomationsModule,
    
    // External Services
    SupabaseModule,
    ElasticsearchModule,
    RedisModule,
    QueueModule,
    
    // Feature Modules
    AuthModule,
    UsersModule,
    JobSeekersModule,
    EmployersModule,
    FreelancersModule,
    JobsModule,
    ApplicationsModule,
    SavedJobsModule,
    JobAlertsModule,
    RecommendationsModule,
    SchedulingModule,
    GigsModule,
    ContractsModule,
    PaymentsModule,
    BillingModule,
    AtsModule,
    DistributionModule,
    CommunityModule,
    SearchModule,
    StorageModule,
    AdminModule,
    VerificationsModule,
    ResumeMatcherModule,
    HiringModule,
    IntegrationsModule,
    MessagingModule,
    InterviewCoachModule,
    SeekerEntitlementsModule,
    SeekerBillingModule,
    FairnessModule,
    ReviewsModule,
    NotificationsModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
