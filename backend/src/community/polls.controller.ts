import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User } from '../common/types/user.types';
import { PollsService } from './polls.service';
import { GifsService } from './gifs.service';

export class VoteDto {
  @IsUUID()
  optionId!: string;
}

export class AdoptGifDto {
  @IsString()
  @MaxLength(2048)
  url!: string;
}

/**
 * Polls and the GIF picker.
 *
 * Both sit under community because both only exist inside a post; neither is
 * a general-purpose service and neither should look like one.
 */
@Controller('community')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PollsController {
  constructor(
    private readonly polls: PollsService,
    private readonly gifs: GifsService,
  ) {}

  @Post('polls/:id/vote')
  async vote(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoteDto,
  ) {
    return { success: true, data: await this.polls.vote(user, id, dto.optionId) };
  }

  /** Withdraws a vote, which hides the counts again. */
  @Delete('polls/:id/vote')
  async unvote(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.polls.unvote(user, id) };
  }

  /**
   * Whether GIF search is usable, so the composer can hide the button rather
   * than offer one that always errors.
   */
  @Public()
  @Get('gifs/status')
  gifStatus() {
    return { success: true, data: { available: this.gifs.configured } };
  }

  @Get('gifs/search')
  async searchGifs(@Query('q') q: string) {
    return { success: true, data: await this.gifs.search(q ?? '') };
  }

  /** Copies the chosen GIF into our own storage and returns our URL. */
  @Post('gifs/adopt')
  async adoptGif(@CurrentUser() user: User, @Body() dto: AdoptGifDto) {
    return { success: true, data: await this.gifs.adopt(user, dto.url) };
  }
}
