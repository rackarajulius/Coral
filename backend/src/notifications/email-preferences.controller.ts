import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { EmailPreferencesService } from './email-preferences.service';

class UnsubscribeDto {
  @IsString() @MaxLength(64) u!: string;
  @IsString() @MaxLength(40) t!: string;
  @IsString() @MaxLength(128) s!: string;
}

/**
 * Unsubscribe from an email link, signed in or not.
 *
 * Its own controller so it can be public without loosening the guarded
 * notification routes beside it. POST only — see EmailPreferencesService.
 */
@Controller('email-preferences')
export class EmailPreferencesController {
  constructor(private readonly prefs: EmailPreferencesService) {}

  @Public()
  @Post('unsubscribe')
  @HttpCode(200)
  async unsubscribe(@Body() dto: UnsubscribeDto) {
    return { success: true, data: await this.prefs.unsubscribe(dto.u, dto.t, dto.s) };
  }
}
