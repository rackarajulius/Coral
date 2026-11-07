import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/user.types';
import { SchedulePostDto, UpdateScheduledPostDto } from './dto/scheduled-post.dto';
import { ScheduledPostsService } from './scheduled-posts.service';

/**
 * Posts written now and published later: a company's, seen and changed by its
 * page's owners and admins, or your own, seen and changed by you.
 */
@Controller('community/scheduled-posts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduledPostsController {
  constructor(private readonly scheduled: ScheduledPostsService) {}

  @Post()
  async schedule(@CurrentUser() user: User, @Body() dto: SchedulePostDto) {
    return { success: true, data: await this.scheduled.schedule(user.id, dto) };
  }

  @Get('mine')
  async listMine(@CurrentUser() user: User) {
    return { success: true, data: await this.scheduled.listMine(user.id) };
  }

  @Get('company/:companyId')
  async list(@CurrentUser() user: User, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return { success: true, data: await this.scheduled.listForCompany(user.id, companyId) };
  }

  @Patch(':id')
  async update(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateScheduledPostDto) {
    return { success: true, data: await this.scheduled.update(user.id, id, dto) };
  }

  @Delete(':id')
  async cancel(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.scheduled.cancel(user.id, id) };
  }
}
