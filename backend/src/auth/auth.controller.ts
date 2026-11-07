import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AccountClosureService } from './account-closure.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { CompanyMemberStatus, UserRole } from '@prisma/client';
import { CompanyContextService } from '../company/company-context.service';
import { Equals, IsEnum, IsObject, IsOptional, IsUUID, ValidateIf } from 'class-validator';

class CloseAccountDto {
  @Equals('CLOSE')
  confirmation!: string;
}

class UpdateRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsUUID()
  userId?: string;
}

class OnboardingDto {
  @IsEnum(UserRole)
  role!: UserRole;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  profileData?: Record<string, unknown>;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountClosure: AccountClosureService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /**
   * Public health check
   */
  @Public()
  @Get('verify')
  verify() {
    return {
      success: true,
      message: 'Auth service is running',
    };
  }

  /**
   * Get current authenticated user (sync with DB)
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getCurrentUser(@CurrentUser() user: User) {
    // User is already properly set up by JwtAuthGuard.getOrCreateUser()
    // which handles admin role assignment based on DEFAULT_ADMIN_EMAIL
    //
    // `company` is the seat this person acts for a company through, if any.
    // With one account for everything, the account type no longer says
    // whether someone may open the company dashboard — a seat does.
    const seat = await this.companyContext.membershipFor(user.id);
    const company =
      seat?.status === CompanyMemberStatus.ACTIVE
        ? { id: seat.company.id, name: seat.company.name, role: seat.role }
        : null;
    return {
      success: true,
      message: 'Authenticated user retrieved',
      data: {
        user: { ...user, company },
        isNewUser: user.status === 'PENDING_ONBOARDING',
      },
    };
  }

  /**
   * Update user role (admin only or self-onboarding)
   * POST /api/v1/auth/role
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('role')
  @HttpCode(HttpStatus.OK)
  async updateRole(
    @Body() dto: UpdateRoleDto,
    @CurrentUser() currentUser: User,
  ) {
    const targetUserId = dto.userId ?? currentUser.id;
    const updatedUser = await this.authService.updateUserRole(
      targetUserId,
      dto.role,
      currentUser,
    );

    return {
      success: true,
      message: 'User role updated successfully',
      data: {
        user: updatedUser,
        isNewUser: updatedUser.status === 'PENDING_ONBOARDING',
      },
    };
  }

  /**
   * Complete onboarding with role-specific profile
   * POST /api/v1/auth/onboarding
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  async completeOnboarding(
    @Body() dto: OnboardingDto,
    @CurrentUser() user: User,
  ) {
    const updatedUser = await this.authService.completeOnboarding(
      user.id,
      dto.role,
      dto.profileData,
    );

    return {
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        user: updatedUser,
        isNewUser: updatedUser.status === 'PENDING_ONBOARDING',
      },
    };
  }

  /**
   * Deactivate current user's account
   * POST /api/v1/auth/deactivate
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivateAccount(@CurrentUser() user: User) {
    await this.authService.deactivateUser(user.id, user);

    return {
      success: true,
      message: 'Account deactivated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('account')
  @HttpCode(HttpStatus.OK)
  async closeAccount(@CurrentUser() user: User, @Body() dto: CloseAccountDto) {
    await this.accountClosure.closeAccount(user, dto.confirmation);
    return { success: true, message: 'Account closed permanently' };
  }

}
