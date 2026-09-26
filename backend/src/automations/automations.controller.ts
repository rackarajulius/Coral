import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ScheduledTaskType, TaskCadence, UserRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { CompanyCapabilityGuard, RequiresCapability } from '../company/company-capability.guard';
import { AutomationsService } from './automations.service';

export class CreateTaskDto {
  @IsEnum(ScheduledTaskType)
  type!: ScheduledTaskType;

  @IsOptional()
  @IsEnum(TaskCadence)
  cadence?: TaskCadence;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  hourLocal?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  weekday?: number;

  /** IANA zone from the creator's browser. */
  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  notifyWhenEmpty?: boolean;

  /** Which saved search to watch. Required by the per-target task types. */
  @IsOptional()
  @IsUUID()
  shortlistId?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsEnum(TaskCadence)
  cadence?: TaskCadence;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  hourLocal?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  weekday?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyWhenEmpty?: boolean;
}

@Controller('employers/automations')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  /** The catalogue. Readable by any member — it explains what is on offer. */
  @Get('templates')
  templates() {
    return { success: true, data: this.automations.templates() };
  }

  @Get()
  async list(@CurrentUser() user: User) {
    return { success: true, data: await this.automations.list(user) };
  }

  // Creating a task means the company starts receiving automated messages about
  // its candidates, so it sits behind the same gate as changing candidate data.
  @RequiresCapability('candidates:write')
  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateTaskDto) {
    return { success: true, data: await this.automations.create(user, dto) };
  }

  @RequiresCapability('candidates:write')
  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return { success: true, data: await this.automations.update(user, id, dto) };
  }

  @RequiresCapability('candidates:write')
  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.automations.remove(user, id) };
  }

  /** Runs it now without disturbing the schedule — the only way to see what a task actually reports. */
  @RequiresCapability('candidates:write')
  @Post(':id/run')
  async runNow(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.automations.runNow(user, id) };
  }
}
