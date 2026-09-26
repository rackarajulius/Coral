import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobMatchService } from './job-match.service';
import { JobFitService } from './job-fit.service';
import { JobLifecycleService } from './job-lifecycle.service';
import { StorageModule } from '../storage/storage.module';
import { CompanyResearchModule } from '../resume-matcher/company-research/company-research.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EmployersModule } from '../employers/employers.module';
import { AiModule } from '../services/ai/ai.module';

@Module({
  imports: [ApplicationsModule, NotificationsModule, AiModule, StorageModule, CompanyResearchModule, AnalyticsModule, EmployersModule],
  controllers: [JobsController],
  providers: [JobsService, JobMatchService, JobFitService, JobLifecycleService],
  exports: [JobsService],
})
export class JobsModule {}
