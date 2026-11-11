import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User } from '../common/types/user.types';
import { PeopleFollowService } from './people-follow.service';

export class RepliesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

/** Following people, from anywhere in the community a person is shown. */
@Controller('community/people')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PeopleController {
  constructor(private readonly follows: PeopleFollowService) {}

  /**
   * The top of someone's community page. Public, like their posts; only
   * people who have posted or replied have one.
   */
  @Public()
  @Get(':id')
  async card(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: User) {
    return { success: true, data: await this.follows.card(user?.id ?? null, id) };
  }

  /** Their replies on posts, newest first: the Replies tab of their page. Public, like the posts. */
  @Public()
  @Get(':id/replies')
  async replies(@Param('id', ParseUUIDPipe) id: string, @Query() query: RepliesQueryDto) {
    return { success: true, ...(await this.follows.replies(id, query.page ?? 1, query.limit ?? 20)) };
  }

  /** Follower count for anyone; whether you follow them when signed in. */
  @Public()
  @Get(':id/follow')
  async status(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: User) {
    return { success: true, data: await this.follows.status(user?.id ?? null, id) };
  }

  @Post(':id/follow')
  async follow(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return { success: true, data: await this.follows.follow(user.id, id) };
  }

  @Delete(':id/follow')
  async unfollow(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return { success: true, data: await this.follows.unfollow(user.id, id) };
  }
}
