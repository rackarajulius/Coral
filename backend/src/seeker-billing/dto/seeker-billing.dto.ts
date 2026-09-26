import { BillingInterval } from '@prisma/client';
import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';

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

export class SeekerPortalDto {
  @IsString()
  @MaxLength(200)
  @Matches(RETURN_PATH, { message: 'returnPath must be a path within this site' })
  returnPath!: string;
}
