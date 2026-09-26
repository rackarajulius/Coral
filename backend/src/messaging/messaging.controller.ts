import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { MessagingService } from './messaging.service';
import { StartConversationDto } from './dto/start-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AssistMessageDto } from './dto/assist-message.dto';
import { CompanyCapabilityGuard, RequiresCapability } from '../company/company-capability.guard';

@Controller('messaging')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.EMPLOYER, UserRole.JOB_SEEKER, UserRole.ADMIN)
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('conversations')
  async list(@CurrentUser() user: User) {
    return { success: true, data: await this.messaging.listConversations(user) };
  }

  @Get('conversations/:id/messages')
  async messages(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('before') before?: string,
  ) {
    return { success: true, data: await this.messaging.getMessages(user, id, before) };
  }

  /** Employer-only: open a thread with a candidate who applied to their job. */
  @RequiresCapability('messaging:write')
  @Post('conversations')
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  async start(@CurrentUser() user: User, @Body() dto: StartConversationDto) {
    return { success: true, data: await this.messaging.startConversation(user, dto) };
  }

  @RequiresCapability('messaging:write')
  @Post('conversations/:id/messages')
  async send(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return { success: true, data: await this.messaging.sendMessage(user, id, dto) };
  }

  @Post('conversations/:id/read')
  async read(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.messaging.markRead(user, id) };
  }

  /** AI composer assist: draft/rewrite a reply or summarize the thread. */
  @Post('conversations/:id/assist')
  async assist(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssistMessageDto,
  ) {
    return { success: true, data: await this.messaging.assist(user, id, dto) };
  }

  /**
   * Uploads one attachment; returns metadata to include when sending the message.
   * An attachment exists only to be sent, so it needs the seat that can send.
   * Candidates are unaffected — capabilities only apply to employer seats.
   */
  @RequiresCapability('messaging:write')
  @Post('conversations/:id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return { success: true, data: await this.messaging.uploadAttachment(user, id, file) };
  }
}
