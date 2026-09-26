import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SourceCandidatesDto {
  /**
   * What the recruiter typed.
   *
   * Free text, and boolean-aware: quoted phrases, `OR`, and `-term` or
   * `NOT term` to exclude. See search-query.ts.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  /** Every one of these must be on the profile. Narrower than the free text. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  skills?: string[];

  /** Matched against the profile's own experience level, loosely. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  seniority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  industry?: string;

  /**
   * Years of experience, computed from the profile's roles rather than stored,
   * so these are applied after the query rather than inside it.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  minYears?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  maxYears?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  remoteOnly?: boolean;

  /** Narrow to people who say they are actively looking. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  openToWorkOnly?: boolean;
}
