import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { FollowSuggestionsService } from './follow-suggestions.service';

/**
 * The suggestion tabs of the community's Following page. Signed in only:
 * every suggestion is worked out from who the viewer follows.
 */
@Controller('community/follow-suggestions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FollowSuggestionsController {
  constructor(private readonly suggestions: FollowSuggestionsService) {}

  /** Who to follow: people and company pages, best first, each with one reason. */
  @Get('people')
  async people(@CurrentUser() user: User) {
    return { success: true, data: await this.suggestions.whoToFollow(user.id) };
  }

  /** Professionals for you: public provider pages not followed yet. */
  @Get('professionals')
  async professionals(@CurrentUser() user: User) {
    return { success: true, data: await this.suggestions.professionals(user.id) };
  }

  /** ✕ on a suggestion. `kind` is person or company. */
  @Post(':kind/:id/dismiss')
  async dismiss(@CurrentUser() user: User, @Param('kind') kind: string, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.suggestions.dismiss(user.id, kind, id) };
  }

  @Delete(':kind/:id/dismiss')
  async undismiss(@CurrentUser() user: User, @Param('kind') kind: string, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.suggestions.undismiss(user.id, kind, id) };
  }
}
