/**
 * What a job seeker gets on each tier — the one place those numbers live.
 *
 * Changing an allowance is an edit here, not a code change anywhere else.
 * Jobseeker Premium is billed per person and is a different product from the
 * employer plans in `billing/plan-entitlements.ts`; keep them apart.
 *
 * `null` means unlimited. `0` means the tier doesn't include it at all, which
 * is reported as "Premium required" rather than "you've used your 0".
 *
 * Matching against jobs posted on this platform is not metered: it costs one
 * batched scoring call and no outside data, and it is what the free tier is
 * promised in full.
 */
export type SeekerTier = 'free' | 'premium';

export type SeekerMetric =
  | 'coach.session'
  | 'matcher.web'
  | 'assist.cover_letter'
  | 'assist.tailor'
  | 'research.company';

/** Calendar windows in UTC. A new window is a new usage row; nothing resets. */
export type UsageWindow = 'day' | 'month';

export interface MetricRule {
  label: string;
  /** How the thing is named mid-sentence in a refusal: "free AI interviews". */
  noun: string;
  window: UsageWindow;
  limits: Record<SeekerTier, number | null>;
}

export const SEEKER_METRICS: Record<SeekerMetric, MetricRule> = {
  'coach.session': {
    label: 'Interview coach sessions',
    noun: 'AI interviews',
    window: 'month',
    // Premium's cap is fair use, not a product tier: it exists so one account
    // can't run up an unbounded voice-and-model bill.
    limits: { free: 2, premium: 40 },
  },
  'matcher.web': {
    label: 'Web job searches',
    noun: 'web job searches',
    window: 'day',
    limits: { free: 0, premium: 20 },
  },
  'assist.cover_letter': {
    label: 'Cover letters',
    noun: 'cover letters',
    window: 'month',
    limits: { free: 0, premium: 60 },
  },
  'assist.tailor': {
    label: 'Resume tailoring',
    noun: 'resume tailoring',
    window: 'month',
    limits: { free: 0, premium: 60 },
  },
  'research.company': {
    label: 'Company research',
    noun: 'company research',
    window: 'month',
    limits: { free: 0, premium: 30 },
  },
};

export const SEEKER_METRIC_KEYS = Object.keys(SEEKER_METRICS) as SeekerMetric[];

/** Why something isn't available, in a form the client can act on. */
export type EntitlementBlock = 'PREMIUM_REQUIRED' | 'ALLOWANCE_EXHAUSTED';

/** Start of the UTC window containing `at`. */
export function windowStart(window: UsageWindow, at = new Date()): Date {
  return window === 'day'
    ? new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()))
    : new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

/** When the window containing `at` ends, i.e. when the allowance comes back. */
export function windowEnd(window: UsageWindow, at = new Date()): Date {
  return window === 'day'
    ? new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1))
    : new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
}
