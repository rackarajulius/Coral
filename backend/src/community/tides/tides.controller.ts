import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../../common/types/user.types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
  CancelTideDto,
  CreateTideDto,
  ListTidesQueryDto,
  RsvpDto,
  UpdateTideDto,
} from './dto/tide.dto';
import { TidesService } from './tides.service';

@Controller('community/tides')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TidesController {
  constructor(private readonly tides: TidesService) {}

  /**
   * What is coming up. Public: a careers event nobody can find before signing
   * up is a careers event nobody comes to.
   *
   * The viewer's own answer and the way in are added only when signed in — see
   * TidesService for why the join link never appears here.
   */
  @Public()
  @Get()
  async list(@Query() query: ListTidesQueryDto, @CurrentUser() user?: User) {
    return {
      success: true,
      ...(await this.tides.list({
        companyId: query.companyId,
        past: query.past === 'true',
        page: query.page,
        limit: query.limit,
        viewerId: user?.id,
      })),
    };
  }

  @Public()
  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: User) {
    return { success: true, data: await this.tides.getById(id, user?.id) };
  }

  /**
   * The calendar file. Public, and declared above nothing that could shadow it
   * — ":id/calendar.ics" cannot be mistaken for another route.
   */
  @Public()
  @Get(':id/calendar.ics')
  async ics(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { filename, content } = await this.tides.ics(id);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateTideDto) {
    return { success: true, data: await this.tides.create(user.id, dto) };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTideDto,
  ) {
    return { success: true, data: await this.tides.update(id, user.id, dto) };
  }

  /** Cancelled, never deleted — the people who were coming get told. */
  @Post(':id/cancel')
  async cancel(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelTideDto,
  ) {
    return { success: true, data: await this.tides.cancel(id, user.id, dto) };
  }

  @Post(':id/rsvp')
  async rsvp(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RsvpDto,
  ) {
    return { success: true, data: await this.tides.rsvp(id, user.id, dto) };
  }

  @Delete(':id/rsvp')
  async withdraw(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.tides.withdraw(id, user.id) };
  }
}
