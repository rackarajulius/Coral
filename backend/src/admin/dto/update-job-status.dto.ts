import { IsIn, IsString } from 'class-validator';

/**
 * The statuses an admin may set — the schema's own, nothing invented.
 *
 * `draft` is left out on purpose: un-publishing someone's job into a draft is
 * an employer decision, and an admin who wants a job down has pause, close
 * and archive.
 */
export const ADMIN_SETTABLE_JOB_STATUSES = ['active', 'paused', 'closed', 'archived'] as const;
export type AdminSettableJobStatus = (typeof ADMIN_SETTABLE_JOB_STATUSES)[number];

export class UpdateJobStatusDto {
  @IsString()
  @IsIn(ADMIN_SETTABLE_JOB_STATUSES)
  status: AdminSettableJobStatus;
}
