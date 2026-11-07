import { BillingInterval } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * A path inside this app, never a URL.
 *
 * The employer checkout accepts any absolute https URL, which Stripe then
 * redirects the browser to — our checkout page as the bait for an open
 * redirect. Here the client may only name a path; the server joins it to the
 * configured frontend origin. A leading `//` is refused because browsers treat
 * it as another host.
 */
const RETURN_PATH = /^\/(?!\/)[A-Za-z0-9\-._~/?=&%#]*$/;

export class SeekerCheckoutDto {
  @IsEnum(BillingInterval)
  interval!: BillingInterval;

  @IsString()
  @MaxLength(200)
  @Matches(RETURN_PATH, { message: 'returnPath must be a path within this site' })
  returnPath!: string;
}

/** Stripe's own list of cancellation reasons, so they land in its reports as they are. */
export const CANCEL_REASONS = [
  'too_expensive',
  'unused',
  'missing_features',
  'switched_service',
  'too_complex',
  'low_quality',
  'customer_service',
  'other',
] as const;

/** Why someone is leaving, if they want to say. Both optional. */
export class SeekerCancelDto {
  @IsOptional()
  @IsIn(CANCEL_REASONS)
  reason?: (typeof CANCEL_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class SeekerPortalDto {
  @IsString()
  @MaxLength(200)
  @Matches(RETURN_PATH, { message: 'returnPath must be a path within this site' })
  returnPath!: string;
}
