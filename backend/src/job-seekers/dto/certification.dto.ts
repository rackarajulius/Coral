import { IsBoolean, IsDateString, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateCertificationDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @MaxLength(255)
  issuingOrg: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  issuingOrgLogo?: string;

  @IsDateString()
  issueDate: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsBoolean()
  noExpiration?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  credentialId?: string;

  @IsOptional()
  @IsUrl()
  credentialUrl?: string;
}

export class UpdateCertificationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  issuingOrg?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  issuingOrgLogo?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsBoolean()
  noExpiration?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  credentialId?: string;

  @IsOptional()
  @IsUrl()
  credentialUrl?: string;
}

