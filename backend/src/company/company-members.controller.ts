import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CompanyMemberStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { CompanyCapabilityGuard, RequiresCapability } from './company-capability.guard';
import { CompanyMembersService } from './company-members.service';
import {
  ApproveMemberDto,
  InviteMemberDto,
  SetMemberRoleDto,
} from './dto/company-members.dto';

@Controller('employers/company')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class CompanyMembersController {
  constructor(private readonly members: CompanyMembersService) {}

  /**
   * The role reference. Readable by any member — it explains what the seats
   * mean, and hiding that from the people holding them helps nobody.
   */
  @Get('roles')
  roles() {
    return { success: true, data: this.members.roles() };
  }

  /**
   * The caller's own seat.
   *
   * Ungated on purpose — everyone is allowed to know what they themselves may
   * do. Without it the UI has to guess, which means offering controls the
   * server will refuse: an interviewer who can comment but not tag was shown a
   * "Tag" button whose only outcome was an error.
   */
  @Get('me')
  async mySeat(@CurrentUser() user: User) {
    return { success: true, data: await this.members.mySeat(user) };
  }

  @Get('members')
  async list(@CurrentUser() user: User) {
    return { success: true, data: await this.members.list(user) };
  }

  @RequiresCapability('members:manage')
  @Post('invitations')
  async invite(@CurrentUser() user: User, @Body() dto: InviteMemberDto) {
    return { success: true, data: await this.members.invite(user, dto) };
  }

  @RequiresCapability('members:manage')
  @Delete('invitations/:id')
  async revoke(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.members.revokeInvitation(user, id) };
  }

  @RequiresCapability('members:manage')
  @Post('members/:id/approve')
  async approve(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveMemberDto,
  ) {
    return { success: true, data: await this.members.approve(user, id, dto.role) };
  }

  @RequiresCapability('members:manage')
  @Patch('members/:id/role')
  async setRole(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetMemberRoleDto,
  ) {
    return { success: true, data: await this.members.setRole(user, id, dto.role) };
  }

  @RequiresCapability('members:manage')
  @Post('members/:id/suspend')
  async suspend(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      data: await this.members.setStatus(user, id, CompanyMemberStatus.SUSPENDED),
    };
  }

  @RequiresCapability('members:manage')
  @Post('members/:id/reactivate')
  async reactivate(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      data: await this.members.setStatus(user, id, CompanyMemberStatus.ACTIVE),
    };
  }

  @RequiresCapability('members:manage')
  @Delete('members/:id')
  async remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      data: await this.members.setStatus(user, id, CompanyMemberStatus.REMOVED),
    };
  }
}
