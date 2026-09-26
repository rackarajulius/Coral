import { Controller, Delete, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { CompanyCapabilityGuard, RequiresCapability } from '../company/company-capability.guard';
import { SlackService } from './slack.service';

@Controller('integrations/slack')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class SlackIntegrationController {
  constructor(private readonly slack: SlackService) {}

  /** Readable by any member — knowing a channel is connected is not sensitive. */
  @Get('status')
  async status(@CurrentUser() user: User) {
    return { success: true, data: await this.slack.status(user) };
  }

  /** Returns the install URL; the client opens it. */
  @RequiresCapability('integrations:manage')
  @Post('connect')
  async connect(@CurrentUser() user: User) {
    return { success: true, data: { url: await this.slack.authUrl(user) } };
  }

  @RequiresCapability('integrations:manage')
  @Post('test')
  async test(@CurrentUser() user: User) {
    return { success: true, data: await this.slack.test(user) };
  }

  @RequiresCapability('integrations:manage')
  @Delete()
  async disconnect(@CurrentUser() user: User) {
    return { success: true, data: await this.slack.disconnect(user) };
  }
}

/**
 * Slack redirects the browser here after install, with no session attached.
 *
 * Public by necessity, which is why the `state` parameter is HMAC-signed: it is
 * the only thing proving which company started the flow, and without a
 * signature anyone could bind their own workspace to another company's id.
 */
@Controller('integrations/slack')
export class SlackCallbackController {
  constructor(private readonly slack: SlackService) {}

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const destination = await this.slack.handleCallback(code, state);
    return res.redirect(destination);
  }
}
