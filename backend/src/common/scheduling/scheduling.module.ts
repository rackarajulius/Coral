import { Global, Module } from '@nestjs/common';
import { CronLeaseService } from './cron-lease.service';
import { ScheduledJobsController } from './scheduled-jobs.controller';

/**
 * The lease behind every @ExclusiveCron. Global because the decorator is used
 * across the app and the admin health page reads the lease table.
 */
@Global()
@Module({
  controllers: [ScheduledJobsController],
  providers: [CronLeaseService],
  exports: [CronLeaseService],
})
export class SchedulingModule {}
