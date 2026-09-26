import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/types/user.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { ConfirmWorkEmailDto, StartWorkEmailDto } from './dto/work-email.dto';
import { WorkEmailService } from './work-email.service';
import { VerificationsService } from './verifications.service';

@Controller('verifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JOB_SEEKER, UserRole.EMPLOYER, UserRole.ADMIN)
export class VerificationsController {
  constructor(
    private readonly verificationsService: VerificationsService,
    private readonly workEmailService: WorkEmailService,
  ) {}

  @Post()
  async requestVerification(@CurrentUser() user: User, @Body() dto: CreateVerificationDto) {
    const verification = await this.verificationsService.requestVerification(user.id, dto);
    return {
      success: true,
      message: 'Verification request submitted',
      data: verification,
    };
  }

  @Post('document')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^(image\/(png|jpe?g|webp)|application\/pdf)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const path = await this.verificationsService.uploadDocument(user.id, file);
    return {
      success: true,
      message: 'Document uploaded',
      data: { documentUrl: path },
    };
  }

  /**
   * Work-email verification, step 1: send a code to an address at the
   * company's own domain. Free, unlike an identity provider, and it is the
   * only verification here that settles without a person reviewing it.
   */
  @Post('work-email/start')
  async startWorkEmail(@CurrentUser() user: User, @Body() dto: StartWorkEmailDto) {
    const result = await this.workEmailService.start(user.id, dto.experienceId, dto.email);
    return {
      success: true,
      message: `Code sent to ${result.sentTo}`,
      data: result,
    };
  }

  /** Step 2: the code proves the address, and the outcome lands on the role. */
  @Post('work-email/confirm')
  async confirmWorkEmail(@CurrentUser() user: User, @Body() dto: ConfirmWorkEmailDto) {
    const result = await this.workEmailService.confirm(user.id, dto.experienceId, dto.code);
    return {
      success: true,
      message: result.message,
      data: result,
    };
  }

  @Get('me')
  async listMyVerifications(@CurrentUser() user: User) {
    const verifications = await this.verificationsService.listMyVerifications(user.id);
    return {
      success: true,
      data: verifications,
    };
  }

  @Delete(':id')
  async withdraw(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.verificationsService.withdraw(user.id, id);
    return {
      success: true,
      message: 'Verification request withdrawn',
    };
  }
}
