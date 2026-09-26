import { Type } from 'class-transformer';
import { IsBooleanString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Filters for the employer candidates board.
 *
 * These used to be applied in the browser over the 200 most recent
 * applications, which meant "top applicants" only ever ranked the newest 200.
 * They are query parameters now so the database does the work.
 */
export class ApplicantsQueryDto {
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

  /** Comma-separated job ids — the board's job filter is multi-select. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  jobId?: string;


  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  /** Name, email or job title. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;

  @IsOptional()
  @IsIn(['match', 'recent'])
  sort?: 'match' | 'recent';

  /** Rejected applicants are excluded unless asked for. */
  @IsOptional()
  @IsBooleanString()
  includeRejected?: string;
}
