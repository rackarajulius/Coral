import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CompanyResearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  company: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  jobTitle?: string;
}
