import { Module } from '@nestjs/common';
import { EmailModule } from '../services/email/email.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EmailPreferencesController } from './email-preferences.controller';
import { EmailPreferencesService } from './email-preferences.service';

@Module({
  imports: [EmailModule],
  controllers: [NotificationsController, EmailPreferencesController],
  providers: [NotificationsService, EmailPreferencesService],
  exports: [NotificationsService, EmailPreferencesService],
})
export class NotificationsModule {}
