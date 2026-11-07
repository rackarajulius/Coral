import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/types/user.types';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { ProfileProjectsService } from './profile-projects.service';

/** The projects on your own profile. Visitors see them in the profile's public views. */
@Controller('job-seekers/me/projects')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
export class ProfileProjectsController {
  constructor(private readonly projects: ProfileProjectsService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return { success: true, data: await this.projects.list(user.id) };
  }

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateProjectDto) {
    return { success: true, data: await this.projects.create(user.id, dto) };
  }

  @Patch(':id')
  async update(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto) {
    return { success: true, data: await this.projects.update(user.id, id, dto) };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.projects.remove(user.id, id);
    return { success: true };
  }
}
