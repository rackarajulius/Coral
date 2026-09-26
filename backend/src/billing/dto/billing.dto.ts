import { BillingInterval, CompanyPlan } from '@prisma/client';
import { IsEnum, IsString, IsUrl, MaxLength } from 'class-validator';

/**
 * Return URLs are validated as absolute http(s) URLs rather than accepted as
 * free text: Stripe redirects the browser to whatever is passed, so an
 * unvalidated value here is an open redirect with our checkout as the bait.
 */
const URL_RULES = { require_tld: false, require_protocol: true, protocols: ['http', 'https'] };

export class CreateCheckoutDto {
  @IsEnum(CompanyPlan)
  plan!: CompanyPlan;

  @IsEnum(BillingInterval)
  interval!: BillingInterval;

  @IsString()
  @MaxLength(2048)
  @IsUrl(URL_RULES)
  successUrl!: string;

  @IsString()
  @MaxLength(2048)
  @IsUrl(URL_RULES)
  cancelUrl!: string;
}

export class CreatePortalDto {
  @IsString()
  @MaxLength(2048)
  @IsUrl(URL_RULES)
  returnUrl!: string;
}
