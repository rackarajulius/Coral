import { Controller, Get, Patch, Param, Body, UseGuards, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { UserRole } from '@prisma/client';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get current user's full profile
   * GET /api/v1/users/me/profile
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('me/profile')
  async getMyProfile(@CurrentUser() user: User) {
    const profile = await this.usersService.getUserProfile(user.id, user);
    return {
      success: true,
      data: profile,
    };
  }

  /**
   * Get user statistics
   * GET /api/v1/users/me/stats
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('me/stats')
  async getMyStats(@CurrentUser() user: User) {
    const stats = await this.usersService.getUserStats(user.id);
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Update current user's basic info
   * PATCH /api/v1/users/me
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('me')
  async updateMe(
    @CurrentUser() user: User,
    @Body() dto: UpdateUserDto,
  ) {
    const updatedUser = await this.usersService.updateUser(user.id, user, dto);
    return {
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        displayName: updatedUser.displayName,
        avatarUrl: updatedUser.avatarUrl,
      },
    };
  }

  /**
   * Admin: Search users
   * GET /api/v1/users/search?query=...
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('search')
  async searchUsers(
    @Query('query') query: string,
    @Query('limit') limit?: string,
  ) {
    const users = await this.usersService.searchUsers(
      query,
      limit ? parseInt(limit, 10) : 20,
    );
    return {
      success: true,
      data: users,
    };
  }

  /**
   * Get public profile by ID
   * GET /api/v1/users/:id
   */
  @Get(':id')
  async getUserById(@Param('id') userId: string) {
    const user = await this.usersService.getUserById(userId);
    return {
      success: true,
      data: user,
    };
  }
}
