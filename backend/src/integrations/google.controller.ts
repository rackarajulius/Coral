import { Controller, Delete, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { GoogleCalendarService } from './google-calendar.service';

@Controller('integrations/google')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GoogleIntegrationController {
  constructor(private readonly google: GoogleCalendarService) {}

  /** Whether the integration is configured server-side + connected for this user. */
  @Get('status')
  async status(@CurrentUser() user: User) {
    const configured = this.google.isConfigured();
    const conn = configured ? await this.google.getConnection(user.id) : { connected: false, email: null };
    return { success: true, data: { configured, ...conn } };
  }

  /** Returns the Google consent URL to redirect the browser to. */
  @Post('connect')
  connect(@CurrentUser() user: User) {
    return { success: true, data: { url: this.google.getConnectUrl(user.id) } };
  }

  @Delete('connection')
  async disconnect(@CurrentUser() user: User) {
    await this.google.disconnect(user.id);
    return { success: true, message: 'Google Calendar disconnected' };
  }
}

/**
 * OAuth redirect target — hit by the user's browser coming back from Google,
 * so it carries no bearer token. Identity comes from the HMAC-signed `state`.
 */
@Controller('integrations/google')
export class GoogleCallbackController {
  constructor(
    private readonly google: GoogleCalendarService,
    private readonly config: ConfigService,
  ) {}

  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const frontend = this.config.get<string>('FRONTEND_URL', 'http://localhost:8081').replace(/\/$/, '');
    try {
      if (!code) throw new Error('missing code');
      await this.google.handleCallback(code, state);
      return res.redirect(`${frontend}/oauth/google?status=connected`);
    } catch {
      return res.redirect(`${frontend}/oauth/google?status=error`);
    }
  }
}
