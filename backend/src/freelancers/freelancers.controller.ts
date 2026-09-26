import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/types/user.types';
import { UpdateFreelancerProfileDto } from './dto/update-freelancer-profile.dto';
import { FreelancersService } from './freelancers.service';

@Controller('freelancers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FreelancersController {
  constructor(private readonly freelancersService: FreelancersService) {}

  @Public()
  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    const profile = await this.freelancersService.getPublicProfile(id);
    return {
      success: true,
      data: profile,
    };
  }

  @Roles(UserRole.FREELANCER, UserRole.ADMIN)
  @Get('me/profile')
  async getMyProfile(@CurrentUser() user: User) {
    const profile = await this.freelancersService.getMyProfile(user.id);
    return {
      success: true,
      data: profile,
    };
  }

  @Roles(UserRole.FREELANCER, UserRole.ADMIN)
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

