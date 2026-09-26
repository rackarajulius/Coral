import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OutreachResponse } from '@prisma/client';

export class RespondOutreachDto {
  @IsEnum(OutreachResponse)
  response!: OutreachResponse;

  /**
   * Anything the candidate wants to add. Optional on purpose: a one-click answer
   * is what makes people answer at all, and a required box would turn "not
   * now" into silence.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
