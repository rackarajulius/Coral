import { IsDateString, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class CreateJobApplicationDto {
  @IsOptional()
  @IsString()
  coverLetter?: string;

  @IsOptional()
  @IsUrl()
  resumeUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedSalary?: number;

  @IsOptional()
  @IsDateString()
  availabilityDate?: string;

}
