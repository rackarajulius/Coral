import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Query params for the paginated admin jobs list (rich filter set). */
export class JobsListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;

  @IsOptional() @IsString() search?: string;

  /** Comma-separated UI statuses, e.g. "Active,Pending". */
  @IsOptional() @IsString() statuses?: string;
  /** Comma-separated UI types, e.g. "Full-time,Contract". */
  @IsOptional() @IsString() types?: string;

  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsString() salaryMin?: string;
  @IsOptional() @IsString() salaryMax?: string;
  @IsOptional() @IsString() minApplications?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsString() flaggedOnly?: string;

  /** postedDate | applications */
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsIn(['asc', 'desc']) sortDir?: 'asc' | 'desc';
}
