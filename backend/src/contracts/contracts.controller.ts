import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { User } from '../common/types/user.types';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';

@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get('me')
  listMyContracts(@CurrentUser() user: User, @Query() pagination: PaginationDto) {
    return {
      success: true,
      ...this.contractsService.listMyContracts(user.id, pagination),
    };
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return {
      success: true,
      data: this.contractsService.getContractById(id, user.id),
    };
  }

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateContractDto) {
    return this.contractsService.createContract(user.id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body('status') status: string,
  ) {
    return this.contractsService.updateStatus(id, user.id, status);
  }
}

