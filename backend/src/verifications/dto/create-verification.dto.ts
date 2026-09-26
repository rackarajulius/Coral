import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { VerificationType } from '@prisma/client';

export class CreateVerificationDto {
  @IsEnum(VerificationType)
  type: VerificationType;

  /** Required for EXPERIENCE / EDUCATION — the UUID of the record to verify. */
  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  documentUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
