import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

const DUPLICATE_JOB_STATUSES = ['draft', 'active'] as const;
type DuplicateJobStatus = (typeof DUPLICATE_JOB_STATUSES)[number];

export class DuplicateJobDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsEnum(DUPLICATE_JOB_STATUSES)
  status?: DuplicateJobStatus;
}
