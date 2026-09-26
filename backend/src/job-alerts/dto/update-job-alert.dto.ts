import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { JOB_ALERT_FREQUENCIES, JobAlertFrequencyValue } from './create-job-alert.dto';

export class UpdateJobAlertDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  experienceLevel?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @IsEnum(JOB_ALERT_FREQUENCIES)
  frequency?: JobAlertFrequencyValue;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
