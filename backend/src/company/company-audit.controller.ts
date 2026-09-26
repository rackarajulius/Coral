import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CompanyAuditCategory, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { CompanyCapabilityGuard, RequiresCapability } from './company-capability.guard';
import { CompanyAuditService } from './company-audit.service';

export class AuditQueryDto {
  @IsOptional()
  @IsEnum(CompanyAuditCategory)
  category?: CompanyAuditCategory;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

@Controller('employers/company/audit')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class CompanyAuditController {
  constructor(private readonly audit: CompanyAuditService) {}

  /** Governance surface — owners and admins only, same as the Team tab. */
  @RequiresCapability('members:manage')
  @Get()
  async list(@CurrentUser() user: User, @Query() query: AuditQueryDto) {
    return { success: true, ...(await this.audit.list(user, query)) };
  }
}
