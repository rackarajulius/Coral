import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { JOB_STATUSES, JobStatusValue } from './job.dto';

export class UpdateJobManagementStatusDto {
  @IsEnum(JOB_STATUSES)
  status: JobStatusValue;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  notifyApplicants?: boolean;
}
