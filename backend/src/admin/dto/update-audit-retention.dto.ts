import { IsInt, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AUDIT_RETENTION_MAX_DAYS, AUDIT_RETENTION_MIN_DAYS } from '../settings.service';

export class UpdateAuditRetentionDto {
  @Type(() => Number)
  @IsInt()
  @Min(AUDIT_RETENTION_MIN_DAYS)
  @Max(AUDIT_RETENTION_MAX_DAYS)
  days: number;
}
