import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/types/user.types';
import { CreateJobAlertDto } from './dto/create-job-alert.dto';
import { DispatchJobAlertsDto } from './dto/dispatch-job-alerts.dto';
import { ListJobAlertsQueryDto } from './dto/list-job-alerts-query.dto';
import { UpdateJobAlertDto } from './dto/update-job-alert.dto';
import { JobAlertsService } from './job-alerts.service';

@Controller('job-alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
export class JobAlertsController {
  constructor(private readonly jobAlertsService: JobAlertsService) {}

  @Get()
  async listMyAlerts(@CurrentUser() user: User, @Query() query: ListJobAlertsQueryDto) {
    return {
      success: true,
      ...(await this.jobAlertsService.listMyAlerts(user.id, query)),
    };
  }

  @Post()
  createAlert(@CurrentUser() user: User, @Body() dto: CreateJobAlertDto) {
    return this.jobAlertsService.createAlert(user.id, dto);
  }

  @Patch(':id')
  updateAlert(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobAlertDto,
  ) {
    return this.jobAlertsService.updateAlert(user.id, id, dto);
  }

  @Delete(':id')
  deleteAlert(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobAlertsService.deleteAlert(user.id, id);
  }

  @Roles(UserRole.ADMIN)
  @Post('dispatch/run')
  dispatchNow(@Body() dto: DispatchJobAlertsDto) {
    return this.jobAlertsService.dispatchDueAlerts({
      force: dto.force,
      limit: dto.limit,
      userId: dto.userId,
    });
  }
}
