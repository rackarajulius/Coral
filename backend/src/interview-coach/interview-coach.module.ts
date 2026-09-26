import { Module } from '@nestjs/common';
import { AiModule } from '../services/ai/ai.module';
import { InterviewCoachController } from './interview-coach.controller';
import { SeekerEntitlementsModule } from '../seeker-entitlements/seeker-entitlements.module';
import { InterviewCoachService } from './interview-coach.service';
import { SpeechService } from './speech.service';

@Module({
  // SeekerEntitlementsModule: each AI-planned run counts against the allowance.
  imports: [AiModule, SeekerEntitlementsModule],
  controllers: [InterviewCoachController],
  providers: [InterviewCoachService, SpeechService],
})
export class InterviewCoachModule {}
