import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';

import { WORK_CATEGORY_VALUES } from '../../common/work-categories';

/** The same list as provider profiles: common/work-categories.ts. */
export const CATEGORIES = WORK_CATEGORY_VALUES;
export const CURRENCIES = { CAD: 2, USD: 2, EUR: 2, GBP: 2, JPY: 0, KWD: 3 } as const;
export class MarketplaceQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(CATEGORIES) category?: string;
  @IsOptional() @IsString() @MaxLength(60) skill?: string;
  @IsOptional() @IsIn(['remote', 'hybrid', 'onsite']) workMode?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsIn(['available', 'limited', 'unavailable']) availability?: string;
  /**
   * One professional's own listings, for their provider profile. What they
   * publish for a company is the company's, so it is not included.
   */
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number = 12;
}
export class WorkSampleDto {
  @IsString() @MaxLength(100) label: string;
  @IsString() @MaxLength(2048) url: string;
}
export class ListingFieldsDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsIn(CATEGORIES) category?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(60, { each: true }) skills?: string[];
  @IsOptional() @IsIn(['remote', 'hybrid', 'onsite']) workMode?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string | null;
  @IsOptional() @IsIn(Object.keys(CURRENCIES)) currency?: string;
  @IsOptional() @IsBoolean() publicConsent?: boolean;
}
export class ServiceFieldsDto extends ListingFieldsDto {
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(300, { each: true }) deliverables?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => WorkSampleDto) workSamples?: WorkSampleDto[];
  /** Up to 8 pictures and one video, from POST /community/posts/media. */
  @IsOptional() @IsArray() @ArrayMaxSize(9) @IsString({ each: true }) @MaxLength(2048, { each: true }) mediaUrls?: string[];
  @IsOptional() @IsIn(['available', 'limited', 'unavailable']) availability?: string;
  @IsOptional() @IsIn(['fixed', 'hourly', 'quote']) pricingMode?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000000000) amountMinor?: number | null;
}
export class CreateServiceDto extends ServiceFieldsDto {
  @IsOptional() @IsUUID() companyId?: string;
}
export class ProjectFieldsDto extends ListingFieldsDto {
  @IsOptional() @IsString() @MaxLength(10000) scope?: string;
  @IsOptional() @IsIn(['fixed', 'range', 'negotiable']) budgetMode?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000000000) minBudgetMinor?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(1000000000) maxBudgetMinor?: number | null;
  @IsOptional() @IsISO8601({ strict: true }) deadline?: string | null;
}
export class CreateProjectDto extends ProjectFieldsDto {
  @IsOptional() @IsUUID() companyId?: string;
}
export class ListingStateDto {
  @IsIn(['published', 'open', 'paused', 'closed', 'archived']) status: string;
}
export class ListingReportDto {
  @IsIn(['spam', 'fraud', 'harassment', 'inappropriate', 'other']) reason: string;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
}
