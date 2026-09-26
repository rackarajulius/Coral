import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../../common/types/user.types';
import { FeedService } from './feed.service';
import { FeedQueryDto } from './dto/feed-query.dto';

@Controller('community/feed')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Public()
  @Get()
  async getPublicFeed(@Query() query: FeedQueryDto) {
    return {
      success: true,
      ...(await this.feedService.getFeed(query)),
    };
  }

  @Get('me')
  async getPersonalizedFeed(@CurrentUser() user: User, @Query() query: FeedQueryDto) {
    return {
      success: true,
      ...(await this.feedService.getFeed(query, user.id)),
    };
  }
}
