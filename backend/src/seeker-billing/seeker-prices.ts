import { ConfigService } from '@nestjs/config';
import { BillingInterval } from '@prisma/client';

/**
 * Where jobseeker Premium's Stripe prices come from.
 *
 * Separate env keys from the employer plans (`STRIPE_PRICE_PRO_*`): a
 * different product, a different payer, and a different price. Sharing keys
 * would let one team's change silently reprice the other's customers.
 */
export const SEEKER_PRICE_ENV: Record<BillingInterval, string> = {
  [BillingInterval.MONTHLY]: 'STRIPE_PRICE_SEEKER_MONTHLY',
  [BillingInterval.YEARLY]: 'STRIPE_PRICE_SEEKER_YEARLY',
};

export function seekerPriceId(config: ConfigService, interval: BillingInterval): string {
  return config.get<string>(SEEKER_PRICE_ENV[interval], '').trim();
}

/** Every configured Premium price id. Empty until the Stripe setup is done. */
export function seekerPriceIds(config: ConfigService): string[] {
  return (Object.values(BillingInterval) as BillingInterval[])
    .map((interval) => seekerPriceId(config, interval))
    .filter(Boolean);
}
