import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { MatchScoreService } from './match-score.service';
import { PipelineService } from './pipeline.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
// For SlackService: a new application posts to the company's channel.
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [NotificationsModule, StorageModule, IntegrationsModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, MatchScoreService, PipelineService],
  exports: [ApplicationsService, MatchScoreService, PipelineService],
})
export class ApplicationsModule {}
