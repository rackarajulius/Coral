import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class NotificationSettingsDto {
  @IsOptional() @IsBoolean() emailJobAlerts?: boolean;
  @IsOptional() @IsBoolean() emailApplicationUpdates?: boolean;
  @IsOptional() @IsBoolean() emailMarketing?: boolean;
  @IsOptional() @IsBoolean() pushJobAlerts?: boolean;
  @IsOptional() @IsBoolean() pushApplicationUpdates?: boolean;
  @IsOptional() @IsBoolean() pushMessages?: boolean;
  /** Jobs Coral picks for you — see notifications/seeker-preferences.ts for defaults. */
  @IsOptional() @IsBoolean() pushJobRecommendations?: boolean;
  /** Opt-in: off unless turned on (CASL). */
  @IsOptional() @IsBoolean() emailJobRecommendations?: boolean;
}

export class PrivacySettingsDto {
  @IsOptional() @IsBoolean() profileVisible?: boolean;
  @IsOptional() @IsBoolean() showEmail?: boolean;
  @IsOptional() @IsBoolean() showPhone?: boolean;
  @IsOptional() @IsBoolean() allowMessages?: boolean;
  @IsOptional() @IsBoolean() showSalaryExpectations?: boolean;
}

export class UpdateJobSeekerProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  headline?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  currentTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  currentCompany?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  remotePreference?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  jobTypes?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  experienceLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  salaryExpectation?: string;

  @IsOptional()
  @IsDateString()
  availableFrom?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  // Stored as loose strings (may be partial URLs or cleared to ""), so these
  // use @IsString rather than @IsUrl — a malformed link shouldn't 400 the
  // whole profile save.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkedinUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  githubUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  portfolioUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  twitterUrl?: string;

  @IsOptional()
  @IsUrl()
  resumeUrl?: string;

  @IsOptional()
  @IsBoolean()
  openToWork?: boolean;

  /**
   * Whether recruiters searching for candidates can find this profile.
   *
   * Separate from `privacySettings.profileVisible`, which decides whether the
   * profile can be opened at all. Turning this off leaves the profile readable
   * to someone given the link or to a company the person applied to, and takes
   * them out of sourcing results.
   */
  @IsOptional()
  @IsBoolean()
  discoverable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationSettingsDto)
  notificationSettings?: NotificationSettingsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PrivacySettingsDto)
  privacySettings?: PrivacySettingsDto;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  workEligibility?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  workPermitExpiry?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredLocations?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredIndustries?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsBoolean()
  willingToRelocate?: boolean;

  @IsOptional()
  @IsBoolean()
  remoteWork?: boolean;
}

