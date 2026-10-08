import { Transform } from 'class-transformer';
import {
  ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt,
  IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, ValidateIf,
} from 'class-validator';

import { PROVIDER_CATEGORIES, PROVIDER_WORK_PREFERENCES, PROVIDER_AVAILABILITY } from '../provider-profile-policy';
export { PROVIDER_CATEGORIES, PROVIDER_WORK_PREFERENCES, PROVIDER_AVAILABILITY } from '../provider-profile-policy';

// Restore raw values after implicit conversion: the string "false" must never
// become consent to publish a profile. Actual booleans are required.
const RawValue = () => Transform(({ obj, key }) => obj[key]);

export class UpdateFreelancerProfileDto {
  @RawValue()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  providerEnabled?: boolean;

  @RawValue()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  publicPreviewEnabled?: boolean;

  @IsOptional()
  @IsIn(PROVIDER_CATEGORIES)
  category?: (typeof PROVIDER_CATEGORIES)[number] | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsIn(PROVIDER_WORK_PREFERENCES, { each: true })
  workPreferences?: Array<(typeof PROVIDER_WORK_PREFERENCES)[number]>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  headline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  skills?: string[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  expertise?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  hourlyRate?: string | null;

  @RawValue()
  @ValidateIf((_object, value) => value !== undefined)
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string | null;

  @RawValue()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  availableForRemote?: boolean;

  @IsOptional()
  @IsIn(PROVIDER_AVAILABILITY)
  availability?: (typeof PROVIDER_AVAILABILITY)[number] | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(168)
  hoursPerWeek?: number | null;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'], disallow_auth: true })
  @MaxLength(2048)
  portfolioUrl?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'], disallow_auth: true })
  @MaxLength(2048)
  githubUrl?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'], disallow_auth: true })
  @MaxLength(2048)
  linkedinUrl?: string | null;
}
