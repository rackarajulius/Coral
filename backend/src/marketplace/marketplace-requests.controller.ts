import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User } from '../common/types/user.types';
import { CompletedWorkSettingsDto, CreateMarketplaceRequestDto, MarketplaceMessageDto, MarketplaceMessageQueryDto, MarketplaceRequestQueryDto, MarketplaceRequestReportDto, MarketplaceRequestStateDto, RequestCapabilitiesDto } from './dto/marketplace-requests.dto';
import { MarketplaceRequestsService } from './marketplace-requests.service';

@Controller('marketplace/requests') @UseGuards(JwtAuthGuard)
export class MarketplaceRequestsController {
  constructor(private readonly requests: MarketplaceRequestsService) {}
  @Public() @Get('capabilities') async capabilities(@Query() query: RequestCapabilitiesDto, @CurrentUser() user?: User) { return { success: true, data: await this.requests.capabilities(query.kind, query.listingId, user?.id) }; }
  @Post() async create(@CurrentUser() user: User, @Body() dto: CreateMarketplaceRequestDto) { return { success: true, data: await this.requests.create(user.id, dto) }; }
  @Get() async list(@CurrentUser() user: User, @Query() query: MarketplaceRequestQueryDto) { return { success: true, ...await this.requests.list(user.id, query) }; }
  @Get(':id') async detail(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) { return { success: true, data: await this.requests.get(user.id, id) }; }
  @Post(':id/state') async state(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MarketplaceRequestStateDto) { return { success: true, data: await this.requests.transition(user.id, id, dto.action) }; }
  @Get(':id/messages') async messages(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query() query: MarketplaceMessageQueryDto) { return { success: true, ...await this.requests.messages(user.id, id, query) }; }
  @Post(':id/messages') async send(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MarketplaceMessageDto) { return { success: true, data: await this.requests.send(user.id, id, dto) }; }
  @Post(':id/read') async read(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) { return { success: true, data: await this.requests.read(user.id, id) }; }
  @Post(':id/work/done') async markDone(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) { return { success: true, data: await this.requests.markDone(user.id, id) }; }
  @Post(':id/work/not-done') async unmarkDone(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) { return { success: true, data: await this.requests.unmarkDone(user.id, id) }; }
  @Patch(':id/work') async workSettings(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompletedWorkSettingsDto) { return { success: true, data: await this.requests.workSettings(user.id, id, dto) }; }
  @Post(':id/report') async report(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MarketplaceRequestReportDto) { return { success: true, data: await this.requests.report(user.id, id, dto) }; }
}
