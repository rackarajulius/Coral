import { IsDateString, IsInt, IsOptional, IsString, IsUrl, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateApplicationDto {
  @IsUUID()
  jobId: string;

  @IsOptional()
  @IsString()
  coverLetter?: string;

  @IsOptional()
  @IsUrl()
  resumeUrl?: string;

  /**
   * Storage path of a resume tailored to this application (from
   * `POST /job-seekers/me/resume/for-application`). Ownership is re-verified
   * server-side — a path outside the caller's own folder is rejected.
   */
  @IsOptional()
  @IsString()
  @MaxLength(400)
  resumePath?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedSalary?: number;

  @IsOptional()
  @IsDateString()
  availabilityDate?: string;

}

