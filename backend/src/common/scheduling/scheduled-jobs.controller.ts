import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CronLeaseService } from './cron-lease.service';

/** What the scheduled jobs are doing, across every server. Admin only. */
@Controller('admin/scheduled-jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ScheduledJobsController {
  constructor(private readonly leases: CronLeaseService) {}

  @Get()
  async list() {
    return { success: true, data: await this.leases.status() };
  }

  /** Runs one now. Never alongside a copy that is already running. */
  @Post(':name/run')
  async run(@Param('name') name: string) {
    return { success: true, data: await this.leases.runNow(name) };
  }
}
