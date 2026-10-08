import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const EXTERNAL_STATUSES = [
  'saved',
  'applied',
  'under_review',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
] as const;

export type ExternalStatus = (typeof EXTERNAL_STATUSES)[number];

export class CreateExternalApplicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceKey?: string;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  @MaxLength(255)
  company: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string;

  @IsOptional()
  @IsIn(EXTERNAL_STATUSES)
  status?: ExternalStatus;

  @IsOptional()
  @IsDateString()
  appliedAt?: string;
}

export class UpdateExternalApplicationDto {
  @IsOptional()
  @IsIn(EXTERNAL_STATUSES)
  status?: ExternalStatus;

  @IsOptional()
  @IsDateString()
  appliedAt?: string | null;

  @IsOptional()
  @IsDateString()
  followUpAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
