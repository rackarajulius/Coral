import { ForbiddenException } from '@nestjs/common';
import { EntitlementBlock, SeekerMetric, SeekerTier } from './seeker-entitlements';

/**
 * A refusal the client can act on.
 *
 * Carries a machine-readable `code` so the app shows an upgrade prompt (or the
 * date the allowance comes back) instead of printing an error. The global
 * exception filter passes these fields through; everything else about the
 * response is the ordinary 403.
 */
export class EntitlementException extends ForbiddenException {
  constructor(input: {
    code: EntitlementBlock;
    metric: SeekerMetric;
    tier: SeekerTier;
    resetsAt: string | null;
    message: string;
  }) {
    super(input);
  }
}
