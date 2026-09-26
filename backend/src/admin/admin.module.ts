import { Module } from '@nestjs/common';
import { SeekerBillingModule } from '../seeker-billing/seeker-billing.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MetricSnapshotService } from './metric-snapshot.service';
import { AuditLogService } from './audit-log.service';
import { SettingsService } from './settings.service';
import { SystemHealthService } from './system-health.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  // SeekerBillingModule: admins grant and revoke complimentary Premium.
  imports: [StorageModule, SeekerBillingModule],
  controllers: [AdminController],
  providers: [AdminService, MetricSnapshotService, AuditLogService, SettingsService, SystemHealthService],
  exports: [AuditLogService],
})
export class AdminModule {}
