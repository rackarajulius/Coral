import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User } from '../common/types/user.types';
import { MarketplaceActivityService } from './marketplace-activity.service';
class ListingViewDto {
  @IsIn(['service', 'project']) kind: 'service' | 'project';
  @IsUUID() listingId: string;
  @IsUUID() sessionId: string;
  @IsOptional() @IsIn(['direct', 'community', 'directory', 'profile']) source?: string;
  @IsOptional() @IsUUID() postId?: string;
}
@Controller('marketplace') @UseGuards(JwtAuthGuard)
export class MarketplaceActivityController {
  constructor(private readonly activity: MarketplaceActivityService) {}
  @Public() @Post('events/listing-view') async view(@Body() dto: ListingViewDto, @CurrentUser() user?: User) {
    return { success: true, data: await this.activity.listingView(dto, user?.id) };
  }
  @Get('metrics') async metrics(@CurrentUser() user: User, @Query('days') days?: string) {
    return { success: true, data: await this.activity.metrics(user.id, days === undefined ? 30 : Number(days)) };
  }
  @Get('moderation/request-reports') async reports(@CurrentUser() user: User, @Query('status') status?: string) {
    return { success: true, data: await this.activity.requestReports(user.id, status) };
  }
  @Post('moderation/request-reports/:id/review') async review(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.activity.reviewRequestReport(user.id, id) };
  }
}
