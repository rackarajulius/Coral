import { Controller, Delete, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { MicrosoftCalendarService } from './microsoft-calendar.service';

@Controller('integrations/microsoft')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MicrosoftIntegrationController {
  constructor(private readonly microsoft: MicrosoftCalendarService) {}

  @Get('status')
  async status(@CurrentUser() user: User) {
    const configured = this.microsoft.isConfigured();
    const conn = configured
      ? await this.microsoft.getConnection(user.id)
      : { connected: false, email: null };
    return { success: true, data: { configured, ...conn } };
  }

  /** Returns the consent URL; the client opens it. */
  @Post('connect')
  connect(@CurrentUser() user: User) {
    return { success: true, data: { url: this.microsoft.authUrl(user.id) } };
  }

  @Delete()
  async disconnect(@CurrentUser() user: User) {
    await this.microsoft.disconnect(user.id);
    return { success: true, data: { disconnected: true } };
  }
}

/** Microsoft redirects the browser here after consent, with no session attached. */
@Controller('integrations/microsoft')
export class MicrosoftCallbackController {
  constructor(private readonly microsoft: MicrosoftCalendarService) {}

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    return res.redirect(await this.microsoft.handleCallback(code, state));
  }
}
