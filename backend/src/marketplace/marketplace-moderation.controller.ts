import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { ListingKind } from './marketplace-policy';
import { MarketplaceModerationService } from './marketplace-moderation.service';

class ReportQueueQuery {
  @IsOptional() @IsIn(['open', 'reviewed']) status?: string;
}
class RemovalDto {
  @IsString() @MinLength(3) @MaxLength(1000) reason: string;
}
@Controller('marketplace/moderation')
@UseGuards(JwtAuthGuard)
export class MarketplaceModerationController {
  constructor(private readonly moderation: MarketplaceModerationService) {}
  @Get('reports')
  async reports(@CurrentUser() user: User, @Query() query: ReportQueueQuery) {
    return { success: true, data: await this.moderation.list(user.id, query.status) };
  }
  @Post('reports/:reportId/review')
  async review(@CurrentUser() user: User, @Param('reportId', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.moderation.review(user.id, id) };
  }
  @Post(':kind/:id/remove')
  async remove(@CurrentUser() user: User, @Param('kind') kind: ListingKind,
    @Param('id', ParseUUIDPipe) id: string, @Body() dto: RemovalDto) {
    return { success: true, data: await this.moderation.setRemoval(user.id, kind, id, true, dto.reason) };
  }
  @Post(':kind/:id/restore')
  async restore(@CurrentUser() user: User, @Param('kind') kind: ListingKind, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.moderation.setRemoval(user.id, kind, id, false) };
  }
}
