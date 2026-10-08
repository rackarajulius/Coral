import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { WorkSampleDto } from './marketplace.dto';

export const REQUEST_REPORT_REASONS = ['spam', 'fraud', 'harassment', 'inappropriate', 'other'] as const;
export class RequestCapabilitiesDto {
  @IsIn(['service', 'project']) kind: 'service' | 'project';
  @IsUUID() listingId: string;
}
export class CreateMarketplaceRequestDto extends RequestCapabilitiesDto {
  @IsString() @MinLength(20) @MaxLength(5000) body: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => WorkSampleDto) workSamples?: WorkSampleDto[];
  @IsOptional() @IsUUID() companyId?: string;
  @IsUUID() idempotencyKey: string;
  @IsOptional() @IsIn(['direct', 'community', 'directory', 'profile']) source?: string;
  @IsOptional() @IsUUID() postId?: string;
}
export class MarketplaceRequestQueryDto {
  @IsOptional() @IsIn(['incoming', 'outgoing']) box?: 'incoming' | 'outgoing' = 'incoming';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number = 20;
}
export class MarketplaceMessageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number = 50;
}
export class MarketplaceRequestStateDto {
  @IsIn(['accept', 'decline', 'withdraw', 'block']) action: 'accept' | 'decline' | 'withdraw' | 'block';
}
export class MarketplaceMessageDto {
  @IsString() @MinLength(1) @MaxLength(5000) body: string;
  @IsUUID() idempotencyKey: string;
}
export class MarketplaceRequestReportDto {
  @IsIn(REQUEST_REPORT_REASONS) reason: string;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
}
