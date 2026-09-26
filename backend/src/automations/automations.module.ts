import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { HiringModule } from '../employer-hiring/hiring.module';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { AutomationsScheduler } from './automations.scheduler';

@Module({
  imports: [NotificationsModule, HiringModule],
  controllers: [AutomationsController],
  providers: [AutomationsService, AutomationsScheduler],
  exports: [AutomationsService],
})
export class AutomationsModule {}
