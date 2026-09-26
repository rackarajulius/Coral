import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/types/user.types';
import { SendTestEmailDto } from './dto/send-test-email.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me')
  async getMyNotifications(@CurrentUser() user: User) {
    return {
      success: true,
      ...(await this.notificationsService.listMyNotifications(user.id)),
    };
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: User, @Param('id') id: string) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Post('me/read-all')
  markAllRead(@CurrentUser() user: User) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Post('test-email')
  @Roles(UserRole.ADMIN)
  sendTestEmail(@Body() dto: SendTestEmailDto) {
    return this.notificationsService.sendTestEmail(dto);
  }
}
