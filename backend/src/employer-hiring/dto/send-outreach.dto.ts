import { IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendOutreachDto {
  @IsString()
  candidateId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  role?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  subject: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message: string;

  /**
   * Deliver later instead of now — usually the start of the candidate's
   * working day. ISO 8601; at least a minute ahead, at most 14 days.
   */
  @IsOptional()
  @IsISO8601()
  scheduledFor?: string;
}
