import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { AdminModule } from '../admin/admin.module';
import { EmailModule } from '../services/email/email.module';
import { AdminVerificationsController } from './admin-verifications.controller';
import { VerificationsController } from './verifications.controller';
import { VerificationsService } from './verifications.service';
import { WorkEmailService } from './work-email.service';

@Module({
  imports: [StorageModule, AdminModule, EmailModule],
  controllers: [VerificationsController, AdminVerificationsController],
  providers: [VerificationsService, WorkEmailService],
  exports: [VerificationsService],
})
export class VerificationsModule {}
