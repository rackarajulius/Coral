import type { SeekerMetric } from "@/lib/api/entitlements";

export type EntitlementCode = "PREMIUM_REQUIRED" | "ALLOWANCE_EXHAUSTED";

/**
 * A refusal the app should answer with an upgrade prompt, not an error toast.
 *
 * The server marks these with a `code`. Everything else that fails is still a
 * plain Error, so only genuine "your plan doesn't cover this" cases reach the
 * upgrade dialog.
 */
export class EntitlementError extends Error {
  readonly code: EntitlementCode;
  readonly metric: SeekerMetric;
  readonly tier: "free" | "premium";
  /** When the allowance comes back. Null for "Premium required". */
  readonly resetsAt: string | null;

  constructor(input: {
    code: EntitlementCode;
    metric: SeekerMetric;
    tier: "free" | "premium";
    resetsAt: string | null;
    message: string;
  }) {
    super(input.message);
    this.name = "EntitlementError";
    this.code = input.code;
    this.metric = input.metric;
    this.tier = input.tier;
    this.resetsAt = input.resetsAt;
  }
}

/** Turns a failed response into an EntitlementError when it is one, else an Error. */
export function errorFromBody(body: unknown, fallback: string): Error {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.code === "PREMIUM_REQUIRED" || b.code === "ALLOWANCE_EXHAUSTED") {
    return new EntitlementError({
      code: b.code,
      metric: b.metric as SeekerMetric,
      tier: b.tier === "premium" ? "premium" : "free",
      resetsAt: typeof b.resetsAt === "string" ? b.resetsAt : null,
      message: typeof b.message === "string" ? b.message : fallback,
    });
  }
  return new Error(typeof b.message === "string" && b.message ? b.message : fallback);
}

export function isEntitlementError(error: unknown): error is EntitlementError {
  return error instanceof EntitlementError;
}
