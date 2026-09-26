import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { User } from '../common/types/user.types';
import { SavedJobsService } from './saved-jobs.service';
import { SaveJobDto } from './dto/save-job.dto';

@Controller('saved-jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
export class SavedJobsController {
  constructor(private readonly savedJobsService: SavedJobsService) {}

  @Get()
  async listMySavedJobs(@CurrentUser() user: User, @Query() query: PaginationDto) {
    return {
      success: true,
      ...(await this.savedJobsService.listMySavedJobs(user.id, query)),
    };
  }

  @Post()
  saveJob(@CurrentUser() user: User, @Body() dto: SaveJobDto) {
    return this.savedJobsService.saveJob(user.id, dto.jobId);
  }

  @Delete(':id')
  removeSavedJob(@CurrentUser() user: User, @Param('id') id: string) {
    return this.savedJobsService.removeSavedJob(user.id, id);
  }
}
