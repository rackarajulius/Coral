import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEducationDto {
  @IsString()
  @MaxLength(255)
  institution: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  institutionLogo?: string;

  @IsString()
  @MaxLength(255)
  degree: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fieldOfStudy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  gpa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  honors?: string;

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

export class UpdateEducationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  institution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  institutionLogo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  degree?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fieldOfStudy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  gpa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  honors?: string;

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

