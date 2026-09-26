import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CallMode } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { CallsService } from './calls.service';

export class StartCallDto {
  @IsUUID()
  conversationId!: string;

  @IsEnum(CallMode)
  mode!: CallMode;
}

export class EndCallDto {
  /** True when the peer connection never established, rather than a normal hang-up. */
  @IsOptional()
  @IsBoolean()
  failed?: boolean;
}

/**
 * Calls between an employer and a candidate.
 *
 * Deliberately not role-gated: both sides use the same endpoints, and access is
 * decided by conversation membership — which already encodes the consent that
 * allowed contact in the first place.
 */
@Controller('calls')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Post()
  async start(@CurrentUser() user: User, @Body() dto: StartCallDto) {
    return { success: true, data: await this.calls.start(user, dto.conversationId, dto.mode) };
  }

  @Get(':id')
  async get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.calls.get(user, id) };
  }

  @Post(':id/accept')
  async accept(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.calls.accept(user, id) };
  }

  @Post(':id/decline')
  async decline(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.calls.decline(user, id) };
  }

  @Post(':id/end')
  async end(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EndCallDto) {
    return { success: true, data: await this.calls.end(user, id, dto.failed === true) };
  }

  @Get('conversations/:conversationId/history')
  async history(
    @CurrentUser() user: User,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return { success: true, data: await this.calls.listForConversation(user, conversationId) };
  }
}
