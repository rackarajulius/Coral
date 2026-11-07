import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PROVIDER_CATEGORIES } from './update-freelancer-profile.dto';

export class ProviderDirectoryQueryDto {
  @IsOptional()
  @IsIn(PROVIDER_CATEGORIES)
  category?: (typeof PROVIDER_CATEGORIES)[number];

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  q?: string;

  /** Where they're based: a city, a province or state, or a country, as typed or picked. */
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  location?: string;

  /** "true": only professionals open to remote work. */
  @IsOptional()
  @IsIn(['true', 'false'])
  remote?: 'true' | 'false';

  /** Which page of the directory, from 1. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit?: number;
}
