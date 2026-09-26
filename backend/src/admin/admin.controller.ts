import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { MetricSnapshotService } from './metric-snapshot.service';
import { SystemHealthService } from './system-health.service';
import { AuditLogService } from './audit-log.service';
import {
  SettingsService,
  AUDIT_RETENTION_DEFAULT_DAYS,
  AUDIT_RETENTION_MAX_DAYS,
  AUDIT_RETENTION_MIN_DAYS,
} from './settings.service';
import { UpdateAuditRetentionDto } from './dto/update-audit-retention.dto';
import { AdminListQueryDto } from './dto/admin-list-query.dto';
import { JobsListQueryDto } from './dto/jobs-list-query.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { ApplicationsListQueryDto } from './dto/applications-list-query.dto';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';
import { GrantPremiumDto } from './dto/grant-premium.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly metricSnapshots: MetricSnapshotService,
    private readonly systemHealth: SystemHealthService,
    private readonly settings: SettingsService,
    private readonly auditLogs: AuditLogService,
  ) {}

  @Post('metrics/snapshot')
  async captureMetricSnapshot() {
    await this.metricSnapshots.captureToday();
    return { success: true, message: 'Metric snapshot captured' };
  }

  @Get('users')
  async getAllUsers() {
    const users = await this.adminService.getAllUsers();
    return { success: true, message: 'Users retrieved successfully', data: users };
  }

  @Get('dashboard/metrics')
  async getDashboardMetrics() {
    const metrics = await this.adminService.getDashboardMetrics();
    return { success: true, message: 'Dashboard metrics retrieved successfully', data: metrics };
  }

  @Get('jobseekers/metrics')
  async getJobseekerMetrics() {
    const metrics = await this.adminService.getJobseekerMetrics();
    return { success: true, message: 'Jobseeker metrics retrieved successfully', data: metrics };
  }

  @Get('jobseekers/list')
  async getJobseekersList(@Query() query: AdminListQueryDto) {
    const result = await this.adminService.getJobseekersList(query);
    return { success: true, message: 'Jobseekers list retrieved successfully', ...result };
  }

  @Get('employers/metrics')
  async getEmployerMetrics() {
    const metrics = await this.adminService.getEmployerMetrics();
    return { success: true, message: 'Employer metrics retrieved successfully', data: metrics };
  }

  @Get('employers/list')
  async getEmployersList(@Query() query: AdminListQueryDto) {
    const result = await this.adminService.getEmployersList(query);
    return { success: true, message: 'Employers list retrieved successfully', ...result };
  }

  @Patch('employers/:id/approve')
  async approveEmployer(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.approveEmployer(adminId, id);
    return { success: true, message: 'Employer approved' };
  }

  @Patch('employers/:id/suspend')
  async suspendEmployer(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.setEmployerStatus(adminId, id, 'SUSPENDED');
    return { success: true, message: 'Employer suspended' };
  }

  @Patch('employers/:id/ban')
  async banEmployer(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.setEmployerStatus(adminId, id, 'BANNED');
    return { success: true, message: 'Employer banned' };
  }

  @Patch('employers/:id/activate')
  async activateEmployer(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.setEmployerStatus(adminId, id, 'ACTIVE');
    return { success: true, message: 'Employer activated' };
  }

  @Delete('employers/:id')
  async deleteEmployer(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.deleteEmployer(adminId, id);
    return { success: true, message: 'Employer deleted' };
  }

  @Get('jobs/metrics')
  async getJobsMetrics() {
    const metrics = await this.adminService.getJobsMetrics();
    return { success: true, message: 'Jobs metrics retrieved successfully', data: metrics };
  }

  @Get('jobs/list')
  async getJobsList(@Query() query: JobsListQueryDto) {
    const result = await this.adminService.getJobsList(query);
    return { success: true, message: 'Jobs list retrieved successfully', ...result };
  }

  @Patch('jobseekers/:id/suspend')
  async suspendJobseeker(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.setJobseekerStatus(adminId, id, 'SUSPENDED');
    return { success: true, message: 'Jobseeker suspended' };
  }

  @Patch('jobseekers/:id/activate')
  async activateJobseeker(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.setJobseekerStatus(adminId, id, 'ACTIVE');
    return { success: true, message: 'Jobseeker activated' };
  }

  @Patch('jobseekers/:id/ban')
  async banJobseeker(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.setJobseekerStatus(adminId, id, 'BANNED');
    return { success: true, message: 'Jobseeker banned' };
  }

  /** A job seeker's Premium: whether they pay, whether they're comped, and why. */
  @Get('jobseekers/:id/premium')
  async jobseekerPremium(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.adminService.getJobseekerPremium(id) };
  }

  /** Gives Premium until a date, with a reason. Replaces any running comp. */
  @Post('jobseekers/:id/premium')
  async grantPremium(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GrantPremiumDto,
  ) {
    return { success: true, data: await this.adminService.grantJobseekerPremium(adminId, id, dto) };
  }

  /** Ends a comp now. A paid subscription is never touched. */
  @Delete('jobseekers/:id/premium')
  async revokePremium(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.adminService.revokeJobseekerPremium(adminId, id) };
  }

  @Delete('jobseekers/:id')
  async deleteJobseeker(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.deleteJobseeker(adminId, id);
    return { success: true, message: 'Jobseeker deleted' };
  }

  @Patch('jobs/:id/status')
  async updateJobStatus(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateJobStatusDto) {
    await this.adminService.setJobStatus(adminId, id, dto.status);
    return { success: true, message: 'Job status updated' };
  }

  @Delete('jobs/:id')
  async deleteJob(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.deleteJob(adminId, id);
    return { success: true, message: 'Job deleted' };
  }

  @Get('applications/metrics')
  async getApplicationsMetrics() {
    const metrics = await this.adminService.getApplicationsMetrics();
    return { success: true, message: 'Applications metrics retrieved successfully', data: metrics };
  }

  @Get('applications/list')
  async getApplicationsList(@Query() query: ApplicationsListQueryDto) {
    const result = await this.adminService.getApplicationsList(query);
    return { success: true, message: 'Applications list retrieved successfully', ...result };
  }

  @Patch('applications/:id/status')
  async updateApplicationStatus(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApplicationStatusDto) {
    await this.adminService.setApplicationStatus(adminId, id, dto.status);
    return { success: true, message: 'Application status updated' };
  }

  @Delete('applications/:id')
  async deleteApplication(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.deleteApplication(adminId, id);
    return { success: true, message: 'Application deleted' };
  }

  @Get('audit-logs')
  async getAuditLogs(@Query() query: AuditLogsQueryDto) {
    const result = await this.adminService.getAuditLogs(query);
    return { success: true, message: 'Audit logs retrieved successfully', ...result };
  }

  @Get('settings/audit-retention')
  async getAuditRetention() {
    const days = await this.settings.getAuditRetentionDays();
    return {
      success: true,
      data: {
        days,
        min: AUDIT_RETENTION_MIN_DAYS,
        max: AUDIT_RETENTION_MAX_DAYS,
        default: AUDIT_RETENTION_DEFAULT_DAYS,
      },
    };
  }

  @Patch('settings/audit-retention')
  async updateAuditRetention(
    @CurrentUser('id') adminId: string,
    @Body() dto: UpdateAuditRetentionDto,
  ) {
    const previous = await this.settings.getAuditRetentionDays();
    const days = await this.settings.setAuditRetentionDays(dto.days);

    if (days !== previous) {
      await this.auditLogs.record({
        adminId,
        action: 'Settings Change',
        entityType: 'Settings',
        entityName: 'Audit Log Retention',
        changeSummary: `Retention window changed from ${previous} to ${days} days`,
        before: { days: previous },
        after: { days },
      });
    }

    return { success: true, message: 'Audit retention updated', data: { days } };
  }

  @Get('system-health')
  async getSystemHealth() {
    const data = await this.systemHealth.getHealth();
    return { success: true, message: 'System health retrieved successfully', data };
  }
}
