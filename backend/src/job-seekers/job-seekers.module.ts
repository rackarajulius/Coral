import { Module } from '@nestjs/common';
import { AiModule } from '../services/ai/ai.module';
import { StorageModule } from '../storage/storage.module';
// For MatchScoreService: editing skills rescores this candidate's applications.
import { ApplicationsModule } from '../applications/applications.module';
import { JobSeekersController } from './job-seekers.controller';
import { JobSeekersService } from './job-seekers.service';
import { ProfileImpressionsService } from './profile-impressions.service';

@Module({
  imports: [AiModule, StorageModule, ApplicationsModule],
  controllers: [JobSeekersController],
  providers: [JobSeekersService, ProfileImpressionsService],
  exports: [JobSeekersService, ProfileImpressionsService],
})
export class JobSeekersModule {}
