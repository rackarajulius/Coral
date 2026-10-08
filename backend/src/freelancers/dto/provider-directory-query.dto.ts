import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
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

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit?: number;
}
