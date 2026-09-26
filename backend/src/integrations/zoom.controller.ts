import { Controller, Delete, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { ZoomService } from './zoom.service';

@Controller('integrations/zoom')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ZoomIntegrationController {
  constructor(private readonly zoom: ZoomService) {}

  @Get('status')
  async status(@CurrentUser() user: User) {
    const configured = this.zoom.isConfigured();
    const conn = configured ? await this.zoom.getConnection(user.id) : { connected: false, email: null };
    return { success: true, data: { configured, ...conn } };
  }

  @Post('connect')
  connect(@CurrentUser() user: User) {
    return { success: true, data: { url: this.zoom.authUrl(user.id) } };
  }

  @Delete()
  async disconnect(@CurrentUser() user: User) {
    await this.zoom.disconnect(user.id);
    return { success: true, data: { disconnected: true } };
  }
}

/** Zoom redirects the browser here after consent, with no session attached. */
@Controller('integrations/zoom')
export class ZoomCallbackController {
  constructor(private readonly zoom: ZoomService) {}

  @Public()
  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    return res.redirect(await this.zoom.handleCallback(code, state));
  }
}
