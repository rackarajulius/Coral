import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CompanyLocationDto {
  @IsString()
  id!: string;

  @IsString()
  @MaxLength(100)
  city!: string;

  @IsString()
  @MaxLength(100)
  country!: string;

  @IsOptional()
  @IsBoolean()
  isHQ?: boolean;
}

export class CompanySocialLinkDto {
  @IsString()
  id!: string;

  @IsString()
  @MaxLength(50)
  label!: string;

  @IsUrl()
  url!: string;
}

export class CompanyCoreValueDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsString()
  @MaxLength(40)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  description?: string;
}

export class CompanyGalleryPhotoDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;
}

export class CompanyWhyCardDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsString()
  @MaxLength(60)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;
}

export class CompanyDeiStatDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(80)
  label!: string;

  @IsString()
  @MaxLength(40)
  value!: string;
}

export class CompanyAwardDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(120)
  organization!: string;

  @IsString()
  @MaxLength(20)
  year!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  badgeUrl?: string;
}

export class CreateEmployerCompanyDto {
  @IsString()
  @MaxLength(255)
  companyName!: string;

  @IsString()
  @MaxLength(255)
  jobTitle!: string;

  @IsOptional()
  @IsString()
  companyLogo?: string;

  @IsOptional()
  @IsUrl()
  companyWebsite?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  companySize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @IsOptional()
  @IsBoolean()
  isHiringManager?: boolean;

  @IsOptional()
  @IsBoolean()
  isRecruiter?: boolean;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @IsOptional()
  @IsString()
  companyDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  companyBenefits?: string[];

  @IsOptional()
  @IsString()
  companyCulture?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  culturePhilosophy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  cultureCollaboration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cultureImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  headquarters?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  companyLocations?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanySocialLinkDto)
  socialLinks?: CompanySocialLinkDto[];

  /** Public contact address — not the recruiter's login. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  supportEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  supportPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  tagline?: string;

  @IsOptional()
  @IsString()
  companyBanner?: string;

  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(2100)
  foundedYear?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industries?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyLocationDto)
  locations?: CompanyLocationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyCoreValueDto)
  coreValues?: CompanyCoreValueDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyGalleryPhotoDto)
  galleryPhotos?: CompanyGalleryPhotoDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyWhyCardDto)
  whyWorkHere?: CompanyWhyCardDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyAwardDto)
  awards?: CompanyAwardDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  diversityStatement?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyDeiStatDto)
  deiStats?: CompanyDeiStatDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cultureVideoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  overview?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  mission?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  vision?: string;

  @IsOptional()
  @IsIn(['public', 'unlisted', 'private'])
  visibility?: string;

  @IsOptional()
  @IsBoolean()
  showJobs?: boolean;

  @IsOptional()
  @IsBoolean()
  allowFollow?: boolean;
}

export class UpdateEmployerCompanyDto {
  // Omit it to leave the name alone; a blank one is a wipe, not an edit.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  companyLogo?: string;

  @IsOptional()
  @IsUrl()
  companyWebsite?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  companySize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @IsOptional()
  @IsBoolean()
  isHiringManager?: boolean;

  @IsOptional()
  @IsBoolean()
  isRecruiter?: boolean;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @IsOptional()
  @IsString()
  companyDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  companyBenefits?: string[];

  @IsOptional()
  @IsString()
  companyCulture?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  culturePhilosophy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  cultureCollaboration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cultureImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  headquarters?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  companyLocations?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanySocialLinkDto)
  socialLinks?: CompanySocialLinkDto[];

  /** Public contact address — not the recruiter's login. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  supportEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  supportPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  tagline?: string;

  @IsOptional()
  @IsString()
  companyBanner?: string;

  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(2100)
  foundedYear?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industries?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyLocationDto)
  locations?: CompanyLocationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyCoreValueDto)
  coreValues?: CompanyCoreValueDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyGalleryPhotoDto)
  galleryPhotos?: CompanyGalleryPhotoDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyWhyCardDto)
  whyWorkHere?: CompanyWhyCardDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyAwardDto)
  awards?: CompanyAwardDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  diversityStatement?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyDeiStatDto)
  deiStats?: CompanyDeiStatDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cultureVideoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  overview?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  mission?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  vision?: string;

  @IsOptional()
  @IsIn(['public', 'unlisted', 'private'])
  visibility?: string;

  @IsOptional()
  @IsBoolean()
  showJobs?: boolean;

  @IsOptional()
  @IsBoolean()
  allowFollow?: boolean;
}

export class EmployerCompaniesQueryDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
