import { Module } from '@nestjs/common';
import { EmailModule } from '../services/email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ResumeMatcherModule } from '../resume-matcher/resume-matcher.module';
import { JobAlertsController } from './job-alerts.controller';
import { JobAlertsService } from './job-alerts.service';

@Module({
  // ResumeMatcherModule: alerts search the web the way the matcher does.
  imports: [EmailModule, NotificationsModule, ResumeMatcherModule],
  controllers: [JobAlertsController],
  providers: [JobAlertsService],
  exports: [JobAlertsService],
})
export class JobAlertsModule {}
