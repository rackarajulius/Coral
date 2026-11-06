import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/types/user.types';
import { CompanyCapabilityGuard } from './company-capability.guard';
import { CompanyStatusService } from './company-status.service';

export class ScheduleDeletionDto {
  /** The company's name, typed by the owner, as the confirmation. */
  @IsString()
  @MaxLength(200)
  confirmName!: string;
}

/** The company page's state: deactivate, reactivate and delete it (the owner only). */
@Controller('employers/company/page')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class CompanyStatusController {
  constructor(private readonly status: CompanyStatusService) {}

  @Get()
  async get(@CurrentUser() user: User) {
    return { success: true, data: await this.status.status(user) };
  }

  @Post('deactivate')
  @HttpCode(200)
  async deactivate(@CurrentUser() user: User) {
    return { success: true, data: await this.status.deactivate(user) };
  }

  @Post('reactivate')
  @HttpCode(200)
  async reactivate(@CurrentUser() user: User) {
    return { success: true, data: await this.status.reactivate(user) };
  }

  /** Delete the deactivated page for good, 30 days from now. Confirmed by typing its name. */
  @Post('delete')
  @HttpCode(200)
  async scheduleDeletion(@CurrentUser() user: User, @Body() dto: ScheduleDeletionDto) {
    return { success: true, data: await this.status.scheduleDeletion(user, dto.confirmName) };
  }

  @Post('delete/cancel')
  @HttpCode(200)
  async cancelDeletion(@CurrentUser() user: User) {
    return { success: true, data: await this.status.cancelDeletion(user) };
  }
}
