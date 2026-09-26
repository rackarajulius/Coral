import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { WEBHOOK_EVENTS, WebhooksService } from './webhooks.service';
import { CompanyCapabilityGuard, RequiresCapability } from '../company/company-capability.guard';

export class CreateWebhookDto {
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2000)
  url: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  events?: string[];
}

/** Outbound webhooks — how an employer wires screening results into their ATS. */
@Controller('employers/webhooks')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class WebhooksController {
  constructor(
    private readonly webhooks: WebhooksService) {}

  /** Events an endpoint can subscribe to. */
  @Get('events')
  events() {
    return { success: true, data: { events: WEBHOOK_EVENTS } };
  }

  @Get()
  async list(@CurrentUser() user: User) {
    return { success: true, data: await this.webhooks.list(user) };
  }

  /** Creates an endpoint. The signing secret is returned ONCE, here. */
  @RequiresCapability('integrations:manage')
  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateWebhookDto) {
    return { success: true, data: await this.webhooks.create(user, dto) };
  }

  /** Sends a sample payload containing no candidate data. Same seat as create/delete. */
  @RequiresCapability('integrations:manage')
  @Post(':id/test')
  async test(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.webhooks.test(user, id) };
  }

  @RequiresCapability('integrations:manage')
  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.webhooks.remove(user, id) };
  }
}
