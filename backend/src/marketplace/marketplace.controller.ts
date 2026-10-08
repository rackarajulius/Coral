import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User } from '../common/types/user.types';
import { CreateServiceDto, ListingReportDto, ListingStateDto, MarketplaceQueryDto, ServiceFieldsDto } from './dto/marketplace.dto';
import { MarketplaceService } from './marketplace.service';
@Controller('marketplace') @UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}
  @Public() @Get('capabilities') async capabilities(@CurrentUser() user?: User) { return { success: true, data: await this.marketplace.capabilities(user?.id) }; }
}
@Controller('services') @UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private readonly marketplace: MarketplaceService) {}
  @Public() @Get() async list(@Query() query: MarketplaceQueryDto) { return { success: true, ...await this.marketplace.list('service', query) }; }
  @Get('mine') async mine(@CurrentUser() user: User, @Query() query: MarketplaceQueryDto) { return { success: true, ...await this.marketplace.list('service', query, user.id) }; }
  @Get('mine/:id') async managed(@Param('id') id: string, @CurrentUser() user: User) { return { success: true, data: await this.marketplace.getManaged('service', id, user.id) }; }
  @Public() @Get(':id') async detail(@Param('id') id: string) { return { success: true, data: await this.marketplace.getPublic('service', id) }; }
  @Post() async create(@CurrentUser() user: User, @Body() dto: CreateServiceDto) { return { success: true, data: await this.marketplace.create('service', user.id, dto) }; }
  @Patch(':id') async update(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: ServiceFieldsDto) { return { success: true, data: await this.marketplace.update('service', id, user.id, dto) }; }
  @Post(':id/state') async state(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: ListingStateDto) { return { success: true, data: await this.marketplace.transition('service', id, user.id, dto.status) }; }
  @Post(':id/report') async report(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: ListingReportDto) { return { success: true, data: await this.marketplace.report('service', id, user.id, dto) }; }
}
