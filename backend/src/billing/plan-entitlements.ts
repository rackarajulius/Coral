import { CompanyPlan } from '@prisma/client';

/**
 * Metric keys for usage that accumulates as events.
 *
 * Deliberately not a Prisma enum: adding a metric should not need a migration.
 * Seats and active job posts are absent because they are counted from their own
 * tables on read — a stored copy would drift the first time a member is removed
 * outside the normal path.
 *
 * These are the company's operations only. The jobseeker resume matcher is a
 * separate product billed to User.subscriptionTier, and counting it here would
 * charge an employer for a candidate's usage.
 */
export const AI_METRICS = ['ai.screening', 'ai.search', 'ai.assist'] as const;
export type AiMetric = (typeof AI_METRICS)[number];

/**
 * Features a plan may withhold.
 *
 * Only things the server can actually refuse appear here. "Priority support"
 * and similar marketing lines are real promises but they are not enforced in
 * code, so putting them in this registry would make it a lie about itself.
 */
export const GATED_FEATURES = ['analytics', 'integrations', 'webhooks'] as const;
export type GatedFeature = (typeof GATED_FEATURES)[number];

export interface PlanEntitlements {
  /** Active members. `null` means no cap. */
  seats: number | null;
  /** Job posts in the 'active' state. `null` means no cap. */
  activeJobs: number | null;
  /** Combined AI operations per billing period. `null` means no cap. */
  aiOperations: number | null;
  /**
   * Job boosts started per billing period. `null` means no cap.
   *
   * Derived from JobBoost rows, like seats: a boost leaves a record, so there
   * is nothing to meter. See recommendations/job-boost.service.ts.
   */
  boosts: number | null;
  features: readonly GatedFeature[];
}

/**
 * What each plan includes.
 *
 * Flat tiers with caps: no number here is a billable quantity, so nothing needs
 * reporting back to Stripe when a team grows. Crossing a cap refuses the next
 * action; it never changes the invoice.
 *
 * `null` means unlimited and renders as an em dash rather than a large number —
 * the same rule as an absent match score. An unlimited plan does not have a
 * limit of one million.
 */
export const PLAN_ENTITLEMENTS: Record<CompanyPlan, PlanEntitlements> = {
  [CompanyPlan.STARTER]: {
    seats: 2,
    activeJobs: 3,
    aiOperations: 100,
    boosts: 0,
    features: [],
  },
  [CompanyPlan.PRO]: {
    seats: 12,
    activeJobs: null,
    aiOperations: 5000,
    boosts: 5,
    features: ['analytics', 'integrations', 'webhooks'],
  },
  [CompanyPlan.ENTERPRISE]: {
    seats: null,
    activeJobs: null,
    aiOperations: null,
    boosts: 20,
    features: ['analytics', 'integrations', 'webhooks'],
  },
};

/** Display name and one-line description, so the UI has no plan copy of its own. */
export const PLAN_LABELS: Record<CompanyPlan, { name: string; tagline: string }> = {
  [CompanyPlan.STARTER]: {
    name: 'Starter',
    tagline: 'For small teams getting their first hires in.',
  },
  [CompanyPlan.PRO]: {
    name: 'Pro',
    tagline: 'For growing teams hiring continuously.',
  },
  [CompanyPlan.ENTERPRISE]: {
    name: 'Enterprise',
    tagline: 'For organisations hiring at volume.',
  },
};

export function entitlementsFor(plan: CompanyPlan): PlanEntitlements {
  return PLAN_ENTITLEMENTS[plan];
}

/**
 * Whether a count is within a limit.
 *
 * `null` is unlimited, not zero — the distinction that would otherwise lock
 * every Enterprise customer out of their own account.
 */
export function isWithin(used: number, limit: number | null): boolean {
  return limit === null || used < limit;
}
