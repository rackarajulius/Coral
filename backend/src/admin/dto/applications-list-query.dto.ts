import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Query params for the paginated admin applications list. */
export class ApplicationsListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;

  @IsOptional() @IsString() search?: string;

  /** Comma-separated UI statuses, e.g. "Under Review,Flagged". */
  @IsOptional() @IsString() statuses?: string;
  @IsOptional() @IsString() flaggedOnly?: string;

  /** appliedDate | applicant */
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsIn(['asc', 'desc']) sortDir?: 'asc' | 'desc';
}
