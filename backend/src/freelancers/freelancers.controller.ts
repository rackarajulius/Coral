import {
  Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/types/user.types';
import { WORK_CATEGORIES } from '../common/work-categories';
import { UpdateFreelancerProfileDto } from './dto/update-freelancer-profile.dto';
import { FreelancersService } from './freelancers.service';
import { ProviderDirectoryQueryDto } from './dto/provider-directory-query.dto';

@Controller('freelancers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FreelancersController {
  constructor(private readonly freelancersService: FreelancersService) {}

  @Public()
  @Get()
  async listPublicProfiles(@Query() query: ProviderDirectoryQueryDto) {
    return { success: true, data: await this.freelancersService.listPublicProfiles(query) };
  }

  /**
   * The kinds of work on Coral, with their labels: the web app's only copy.
   * Before `:id`, so "categories" is never read as a provider id.
   */
  @Public()
  @Get('categories')
  listCategories() {
    return { success: true, data: WORK_CATEGORIES };
  }

  /**
   * Your saved professionals. Any signed-in account: employers hire too, and
   * they can't offer services. Before `:id`, so "saved" is never read as an id.
   */
  @Get('saved')
  async listSaved(@CurrentUser() user: User, @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number) {
    return { success: true, data: await this.freelancersService.listSaved(user.id, page) };
  }

  /** Every id you have saved, for the Save buttons. */
  @Get('saved/ids')
  async listSavedIds(@CurrentUser() user: User) {
    return { success: true, data: await this.freelancersService.savedIds(user.id) };
  }

  @Post(':id/save')
  async save(@CurrentUser() user: User, @Param('id') id: string) {
    await this.freelancersService.save(user.id, id);
    return { success: true };
  }

  @Delete(':id/save')
  async unsave(@CurrentUser() user: User, @Param('id') id: string) {
    await this.freelancersService.unsave(user.id, id);
    return { success: true };
  }

  /** Before `:id/responsiveness`, so "me" is never read as a provider id. */
  @Roles(UserRole.JOB_SEEKER, UserRole.FREELANCER)
  @Get('me/responsiveness')
  async getMyResponsiveness(@CurrentUser() user: User) {
    return { success: true, data: await this.freelancersService.getMyResponsiveness(user.id) };
  }

  /** How they reply to requests, measured; null until there is enough to say. */
  @Public()
  @Get(':id/responsiveness')
  async getPublicResponsiveness(@Param('id') id: string) {
    return { success: true, data: await this.freelancersService.getPublicResponsiveness(id) };
  }

  @Public()
  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    const profile = await this.freelancersService.getPublicProfile(id);
    return {
      success: true,
      data: profile,
    };
  }

  @Roles(UserRole.JOB_SEEKER, UserRole.FREELANCER)
  @Get('me/profile')
  async getMyProfile(@CurrentUser() user: User) {
    const profile = await this.freelancersService.getMyProfile(user.id);
    return {
      success: true,
      data: profile,
    };
  }

  @Roles(UserRole.JOB_SEEKER, UserRole.FREELANCER)
  @Patch('me/profile')
  async updateMyProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateFreelancerProfileDto,
  ) {
    const profile = await this.freelancersService.updateMyProfile(user.id, dto);
    return {
      success: true,
      message: 'Freelancer profile updated successfully',
      data: profile,
    };
  }
}

