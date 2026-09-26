import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/types/user.types';
import { CreateGigDto, ListGigsQueryDto } from './dto/gig.dto';
import { GigsService } from './gigs.service';

@Controller('gigs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GigsController {
  constructor(private readonly gigsService: GigsService) {}

  @Public()
  @Get()
  listGigs(@Query() query: ListGigsQueryDto) {
    return {
      success: true,
      ...this.gigsService.listGigs(query),
    };
  }

  @Public()
  @Get(':id')
  getGigById(@Param('id') id: string) {
    return {
      success: true,
      data: this.gigsService.getGigById(id),
    };
  }

  @Roles(UserRole.EMPLOYER, UserRole.FREELANCER, UserRole.ADMIN)
  @Post()
  createGig(@CurrentUser() user: User, @Body() dto: CreateGigDto) {
    return this.gigsService.createGig(user.id, dto);
  }
}

