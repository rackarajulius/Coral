import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

// Neither DTO accepts `verified`. It used to, which meant any job seeker could
// PATCH their own experience with `verified: true` and award themselves the
// badge a recruiter is meant to trust. Only the verification flow writes it —
// see WorkEmailService and VerificationsService.

export class CreateExperienceDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  @MaxLength(255)
  company: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyLogo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  employmentType?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  current?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateExperienceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyLogo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  employmentType?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  current?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
