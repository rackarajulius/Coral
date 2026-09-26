import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { SeekerEntitlementsService } from './seeker-entitlements.service';

/** A job seeker's own allowances and how much of each is used. Own data only. */
@Controller('job-seekers/me/entitlements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
export class SeekerEntitlementsController {
  constructor(private readonly entitlements: SeekerEntitlementsService) {}

  @Get()
  async mine(@CurrentUser() user: User) {
    return { success: true, data: await this.entitlements.snapshot(user) };
  }
}

@Module({
  controllers: [SeekerEntitlementsController],
  providers: [SeekerEntitlementsService],
  exports: [SeekerEntitlementsService],
})
export class SeekerEntitlementsModule {}
