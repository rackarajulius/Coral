import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

/** "2024-09": a project's dates are months. */
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * A project on the profile. Every field but the title may be sent as null to
 * clear it; on an update, a field left out stays as it is.
 */
export class CreateProjectDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @Matches(MONTH, { message: 'startMonth must look like 2024-09' })
  startMonth?: string | null;

  @IsOptional()
  @Matches(MONTH, { message: 'endMonth must look like 2024-09' })
  endMonth?: string | null;

  @IsOptional()
  @IsBoolean()
  current?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  projectUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  mediaUrls?: string[];

  /** The job it was done in: one of their own experiences. */
  @IsOptional()
  @IsUUID()
  experienceId?: string | null;

  /** The service it was done as: one of their own personal listings. */
  @IsOptional()
  @IsUUID()
  serviceListingId?: string | null;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @Matches(MONTH, { message: 'startMonth must look like 2024-09' })
  startMonth?: string | null;

  @IsOptional()
  @Matches(MONTH, { message: 'endMonth must look like 2024-09' })
  endMonth?: string | null;

  @IsOptional()
  @IsBoolean()
  current?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  projectUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsUUID()
  experienceId?: string | null;

  @IsOptional()
  @IsUUID()
  serviceListingId?: string | null;
}
