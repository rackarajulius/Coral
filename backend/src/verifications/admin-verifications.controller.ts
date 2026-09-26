import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/types/user.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { VerificationsQueryDto } from './dto/verifications-query.dto';
import { VerificationsService } from './verifications.service';

@Controller('admin/verifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminVerificationsController {
  constructor(private readonly verificationsService: VerificationsService) {}

  @Get()
  async list(@Query() query: VerificationsQueryDto) {
    const result = await this.verificationsService.list(query);
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id/document')
  async getDocument(@Param('id', ParseUUIDPipe) id: string) {
    const url = await this.verificationsService.getDocumentUrl(id);
    return {
      success: true,
      data: { url },
    };
  }

  @Patch(':id/review')
  async review(
    @CurrentUser() admin: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewVerificationDto,
  ) {
    const verification = await this.verificationsService.review(admin.id, id, dto);
    return {
      success: true,
      message: `Verification ${dto.status.toLowerCase()}`,
      data: verification,
    };
  }
}
