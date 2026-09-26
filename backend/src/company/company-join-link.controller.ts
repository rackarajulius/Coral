import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CompanyRole, UserRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { CompanyCapabilityGuard, RequiresCapability } from './company-capability.guard';
import { CompanyJoinLinkService } from './company-join-link.service';
import { CompanyMembersService } from './company-members.service';

export class RegenerateJoinLinkDto {
  @IsOptional()
  @IsEnum(CompanyRole)
  role?: CompanyRole;

  @IsOptional()
  @IsBoolean()
  domainLocked?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxUses?: number;
}

/**
 * Managing the link. Separate from the join routes below because these require
 * a seat and those, by definition, cannot.
 */
@Controller('employers/company/join-link')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class CompanyJoinLinkController {
  constructor(private readonly links: CompanyJoinLinkService) {}

  @RequiresCapability('members:manage')
  @Get()
  async current(@CurrentUser() user: User) {
    return { success: true, data: await this.links.current(user) };
  }

  @RequiresCapability('members:manage')
  @Post()
  async regenerate(@CurrentUser() user: User, @Body() dto: RegenerateJoinLinkDto) {
    return { success: true, data: await this.links.regenerate(user, dto) };
  }

  @RequiresCapability('members:manage')
  @Delete()
  async revoke(@CurrentUser() user: User) {
    return { success: true, data: await this.links.revoke(user) };
  }
}

/**
 * Joining. Any signed-in user may call these — someone accepting a link is not
 * yet an employer, and requiring the employer role would make the link unusable
 * for exactly the people it is meant for.
 */
@Controller('company-join')
@UseGuards(JwtAuthGuard)
export class CompanyJoinController {
  constructor(
    private readonly links: CompanyJoinLinkService,
    private readonly members: CompanyMembersService,
  ) {}

  @Get('preview')
  async preview(@Query('token') token: string) {
    return { success: true, data: await this.links.preview(token) };
  }

  @Post('accept')
  async accept(@CurrentUser() user: User, @Body('token') token: string) {
    return { success: true, data: await this.links.accept(user, token) };
  }

  /**
   * Addressed invitations use their own pair of routes rather than sniffing the
   * token format. The two are different objects with different rules — one is
   * bound to an address, the other to a domain — and a single endpoint that
   * guessed which it held would eventually apply the wrong rule.
   */
  @Get('invitation/preview')
  async previewInvitation(@Query('token') token: string) {
    return { success: true, data: await this.members.previewInvitation(token) };
  }

  @Post('invitation/accept')
  async acceptInvitation(@CurrentUser() user: User, @Body('token') token: string) {
    return { success: true, data: await this.members.acceptInvitation(user, token) };
  }
}
