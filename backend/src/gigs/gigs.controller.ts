import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User } from '../common/types/user.types';
import { CreateGigDto, ListGigsQueryDto } from './dto/gig.dto';
import { GigsService } from './gigs.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { ListingReportDto, ListingStateDto, ProjectFieldsDto } from '../marketplace/dto/marketplace.dto';

@Controller('gigs')
@UseGuards(JwtAuthGuard)
export class GigsController {
  constructor(private readonly gigsService: GigsService, private readonly marketplace: MarketplaceService) {}

  @Public()
  @Get()
  async listGigs(@Query() query: ListGigsQueryDto) {
    return {
      success: true,
      ...await this.gigsService.listGigs(query),
    };
  }

  @Get('mine') async mine(@CurrentUser() user: User, @Query() query: ListGigsQueryDto) { return { success: true, ...await this.marketplace.list('project', query, user.id) }; }
  @Get('mine/:id') async managed(@Param('id') id: string, @CurrentUser() user: User) { return { success: true, data: await this.marketplace.getManaged('project', id, user.id) }; }

  @Public()
  @Get(':id')
  async getGigById(@Param('id') id: string) {
    return {
      success: true,
      data: await this.gigsService.getGigById(id),
    };
  }

  @Post()
  async createGig(@CurrentUser() user: User, @Body() dto: CreateGigDto) {
    return { success: true, data: await this.gigsService.createGig(user.id, dto) };
  }
  @Patch(':id') async update(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: ProjectFieldsDto) { return { success: true, data: await this.marketplace.update('project', id, user.id, dto) }; }
  @Post(':id/state') async state(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: ListingStateDto) { return { success: true, data: await this.marketplace.transition('project', id, user.id, dto.status) }; }
  @Post(':id/report') async report(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: ListingReportDto) { return { success: true, data: await this.marketplace.report('project', id, user.id, dto) }; }
}

