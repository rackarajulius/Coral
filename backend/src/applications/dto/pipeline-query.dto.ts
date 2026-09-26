import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Filters for the merged candidate board.
 *
 * Deliberately close to ApplicantsQueryDto, which it is the successor to, so
 * the page keeps its saved filters. The difference is `source`, and that
 * `stage` now means a shared pipeline stage rather than the legacy
 * `applications.stage` column.
 */
export class PipelineQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Free text over a candidate's name, role or company — and a job's title. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsIn(['match', 'recent'])
  sort?: 'match' | 'recent';

  /** Comma-separated shared stages, e.g. `SCREENING,INTERVIEW`. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  stage?: string;

  /**
   * Comma-separated job ids. Setting this excludes sourced candidates, who
   * never applied to a job and cannot meaningfully be filtered by one.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  jobId?: string;

  /**
   * Comma-separated tag labels. A candidate matches if they carry ANY of
   * them — tags are one facet, and within a facet more choices widen.
   * Case-insensitive, like the labels people type.
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  tags?: string;

  /** Narrow to one side of the board. Omitted shows both. */
  @IsOptional()
  @IsIn(['applied', 'sourced'])
  source?: 'applied' | 'sourced';

  @IsOptional()
  @IsIn(['true', 'false'])
  includeRejected?: string;
}
