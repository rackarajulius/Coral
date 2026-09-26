import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ANALYTICS_EVENT_TYPES } from '../analytics-events.service';

/**
 * What a browser may send.
 *
 * Note what is NOT here: `employerId`. The server resolves that from the job or
 * profile being viewed. If the client could name the employer, anyone could
 * inflate their own numbers — or bury a competitor's conversion rate under
 * fake views.
 */
export class TrackEventDto {
  @IsIn(ANALYTICS_EVENT_TYPES as unknown as string[])
  type: string;

  /** For job_view / apply_click / apply_started. */
  @IsOptional()
  @IsUUID()
  jobId?: string;

  /** For profile_view — the employer whose profile is being viewed. */
  @IsOptional()
  @IsUUID()
  companyUserId?: string;

  /**
   * `document.referrer` — the only place the true external source exists.
   * Reduced to a host server-side; the full URL is never stored.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  referrer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmCampaign?: string;

  /**
   * IANA timezone from the browser. Used only for a continent-level region
   * when no CDN country header is available.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
