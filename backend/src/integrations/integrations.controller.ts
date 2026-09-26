import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { IntegrationsCatalogueService } from './integrations-catalogue.service';

/**
 * What the employer can connect, and what they already have.
 *
 * Readable by any member — knowing that a calendar is connected is not
 * sensitive. Changing anything goes through the webhook and Google routes,
 * which are gated on `integrations:manage`.
 */
@Controller('employers/integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class IntegrationsController {
  constructor(private readonly catalogue: IntegrationsCatalogueService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return { success: true, data: await this.catalogue.forEmployer(user) };
  }
}
