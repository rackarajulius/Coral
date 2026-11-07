import { Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../../common/types/user.types';
import { CommunityVideosService } from './community-videos.service';

/** Videos for community posts, uploaded straight to Mux and streamed from there. */
@Controller('community/videos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunityVideosController {
  constructor(private readonly videos: CommunityVideosService) {}

  /** Whether long videos are on, and how long one may be. Declared above `:id`. */
  @Get('status')
  status() {
    return { success: true, data: this.videos.status() };
  }

  /**
   * Mux saying an upload or a video changed. Signed with the endpoint's secret;
   * declared above `:id`, and public, because Mux is not signed in.
   */
  @Public()
  @Post('mux-webhook')
  async muxWebhook(
    @Req() request: { rawBody?: string | Buffer; body?: unknown },
    @Headers('mux-signature') signature?: string,
  ) {
    const raw = typeof request.rawBody === 'string'
      ? request.rawBody
      : Buffer.isBuffer(request.rawBody) ? request.rawBody.toString('utf8') : '';
    return { success: true, data: await this.videos.handleWebhook(raw, signature) };
  }

  /** An upload URL for one video. The browser sends the file there, not here. */
  @Post()
  async start(@CurrentUser() user: User) {
    return { success: true, data: await this.videos.start(user.id) };
  }

  @Get(':id')
  async get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.videos.get(user.id, id) };
  }

  @Delete(':id')
  async discard(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.videos.discard(user.id, id) };
  }
}
