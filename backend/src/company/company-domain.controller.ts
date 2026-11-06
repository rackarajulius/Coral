import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsString, Length, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { CompanyCapabilityGuard, RequiresCapability } from './company-capability.guard';
import { CompanyDomainService } from './company-domain.service';

export class DomainDto {
  @IsString()
  @MaxLength(255)
  domain!: string;
}

export class DomainEmailDto {
  @IsString()
  @MaxLength(320)
  email!: string;
}

export class DomainCodeDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

/**
 * The company's domain. Anyone on the team may see it; proving or removing
 * one is for owners and admins, since it decides who joins straight away.
 */
@Controller('employers/company/domain')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class CompanyDomainController {
  constructor(private readonly domains: CompanyDomainService) {}

  @Get()
  async status(@CurrentUser() user: User) {
    return { success: true, data: await this.domains.status(user) };
  }

  @RequiresCapability('members:manage')
  @Post('sign-in')
  async claimBySignIn(@CurrentUser() user: User, @Body() dto: DomainDto) {
    return { success: true, data: await this.domains.claimBySignIn(user, dto.domain) };
  }

  @RequiresCapability('members:manage')
  @Post('dns')
  async startDns(@CurrentUser() user: User, @Body() dto: DomainDto) {
    return { success: true, data: await this.domains.startDns(user, dto.domain) };
  }

  @RequiresCapability('members:manage')
  @Post('dns/check')
  async checkDns(@CurrentUser() user: User) {
    return { success: true, data: await this.domains.checkDns(user) };
  }

  @RequiresCapability('members:manage')
  @Post('email')
  async startEmail(@CurrentUser() user: User, @Body() dto: DomainEmailDto) {
    return { success: true, data: await this.domains.startEmail(user, dto.email) };
  }

  @RequiresCapability('members:manage')
  @Post('email/confirm')
  async confirmEmail(@CurrentUser() user: User, @Body() dto: DomainCodeDto) {
    return { success: true, data: await this.domains.confirmEmail(user, dto.code) };
  }

  @RequiresCapability('members:manage')
  @Delete()
  async release(@CurrentUser() user: User) {
    return { success: true, data: await this.domains.release(user) };
  }
}
