import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { AiModule } from '../services/ai/ai.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';

@Module({
  imports: [NotificationsModule, StorageModule, AiModule],
  controllers: [MessagingController, CallsController],
  providers: [MessagingService, CallsService],
})
export class MessagingModule {}
