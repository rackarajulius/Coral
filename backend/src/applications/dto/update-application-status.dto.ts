import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ApplicationStatus {
  PENDING = 'pending',
  REVIEWING = 'reviewing',
  SHORTLISTED = 'shortlisted',
  INTERVIEWING = 'interviewing',
  OFFERED = 'offered',
  HIRED = 'hired',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

export class UpdateApplicationStatusDto {
  @IsEnum(ApplicationStatus)
  status: ApplicationStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

