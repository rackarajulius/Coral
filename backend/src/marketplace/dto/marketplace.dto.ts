import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export const CATEGORIES = ['design', 'marketing', 'software'] as const;
export const CURRENCIES = { CAD: 2, USD: 2, EUR: 2, GBP: 2, JPY: 0, KWD: 3 } as const;
export class MarketplaceQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(CATEGORIES) category?: string;
  @IsOptional() @IsString() @MaxLength(60) skill?: string;
  @IsOptional() @IsIn(['remote', 'hybrid', 'onsite']) workMode?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsIn(['available', 'limited', 'unavailable']) availability?: string;
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
