import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Query params for the paginated admin audit-log feed. */
export class AuditLogsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;

  @IsOptional() @IsString() search?: string;
  /** UI action label, e.g. "Approve", "Delete". */
  @IsOptional() @IsString() action?: string;
  /** UI entity label, e.g. "Employer", "Job". */
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsIn(['Success', 'Failed']) status?: 'Success' | 'Failed';
  /** Filter to a single admin (User id). */
  @IsOptional() @IsString() adminId?: string;
}
