import { BillingModule } from '../billing/billing.module';
import { JobSeekersModule } from '../job-seekers/job-seekers.module';
import { Module } from '@nestjs/common';
import { AiModule } from '../services/ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../services/email/email.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { StorageModule } from '../storage/storage.module';
import { EmployersModule } from '../employers/employers.module';
import {
  HiringController, CandidateInterviewsController, CandidateScreensController, CandidateOutreachController,
  InterviewRoomController, AvailabilityController, BookingController,
} from './hiring.controller';
import { CandidateSourcingService } from './candidate-sourcing.service';
import { OutreachService } from './outreach.service';
import { InterviewService } from './interview.service';
import { AiScreenService } from './ai-screen.service';
import { AvailabilityService } from './availability.service';
import { CopilotService } from './copilot.service';
import { ShortlistService } from './shortlist.service';
import { IntegrityService } from './integrity.service';

@Module({
  // JobSeekersModule: sourcing records a search appearance on each
  // candidate it returns.
  imports: [AiModule, NotificationsModule, EmailModule, IntegrationsModule, StorageModule, EmployersModule, BillingModule, JobSeekersModule],
  controllers: [
    HiringController, CandidateInterviewsController, CandidateScreensController, CandidateOutreachController,
    InterviewRoomController, AvailabilityController, BookingController,
  ],
  providers: [
    CandidateSourcingService, OutreachService, InterviewService, AiScreenService,
    AvailabilityService, CopilotService, ShortlistService, IntegrityService,
  ],
  // Exported so scheduled saved-search watching filters candidates through the
  // same query the workspace uses, rather than a second copy that can drift.
  exports: [CandidateSourcingService],
})
export class HiringModule {}
