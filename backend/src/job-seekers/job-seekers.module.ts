import { Module } from '@nestjs/common';
import { AiModule } from '../services/ai/ai.module';
import { StorageModule } from '../storage/storage.module';
// For MatchScoreService: editing skills rescores this candidate's applications.
import { ApplicationsModule } from '../applications/applications.module';
import { JobSeekersController } from './job-seekers.controller';
import { JobSeekersService } from './job-seekers.service';
import { ProfileImpressionsService } from './profile-impressions.service';
import { ProfileProjectsController } from './profile-projects.controller';
import { ProfileProjectsService } from './profile-projects.service';

@Module({
  imports: [AiModule, StorageModule, ApplicationsModule],
  controllers: [JobSeekersController, ProfileProjectsController],
  providers: [JobSeekersService, ProfileImpressionsService, ProfileProjectsService],
  exports: [JobSeekersService, ProfileImpressionsService],
})
export class JobSeekersModule {}
