import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

export type SeekerMetric =
  | "coach.session"
  | "matcher.web"
  | "assist.cover_letter"
  | "assist.tailor"
  | "research.company";

export interface MetricStatus {
  metric: SeekerMetric;
  label: string;
  window: "day" | "month";
  used: number;
  /** Null means unlimited; 0 means the tier doesn't include it. */
  limit: number | null;
  /** When the allowance comes back. Null when unlimited or not included. */
  resetsAt: string | null;
  allowed: boolean;
  reason: "PREMIUM_REQUIRED" | "ALLOWANCE_EXHAUSTED" | null;
}

export interface Entitlements {
  tier: "free" | "premium";
  /**
   * False while Premium isn't being charged for. Limits are measured and
   * shown, but nothing is refused — the UI must not imply otherwise.
   */
  enforced: boolean;
  metrics: MetricStatus[];
}

/** GET /job-seekers/me/entitlements — your own allowances only. */
export async function getMyEntitlements(): Promise<Entitlements> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/entitlements`, {
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  });
  if (!res.ok) throw new Error("Could not load your allowances");
  return (await res.json()).data as Entitlements;
}

export function metricOf(e: Entitlements | undefined, metric: SeekerMetric) {
  return e?.metrics.find((m) => m.metric === metric);
}

/** Mid-sentence names, matching the server's refusal wording. */
const NOUNS: Record<SeekerMetric, string> = {
  "coach.session": "AI interviews",
  "matcher.web": "web job searches",
  "assist.cover_letter": "cover letters",
  "assist.tailor": "resume tailoring",
  "research.company": "company research",
};

/**
 * The upgrade prompt for a feature, when the plan wouldn't cover using it now.
 *
 * Null when it's allowed, or when limits aren't being applied yet — in which
 * case the button should simply work, since the server won't refuse it.
 */
export function refusalFor(e: Entitlements | undefined, metric: SeekerMetric) {
  const m = metricOf(e, metric);
  if (!e?.enforced || !m || m.allowed || !m.reason) return null;
  const period = m.window === "day" ? "today's" : "this month's";
  const message =
    m.reason === "PREMIUM_REQUIRED"
      ? `Premium includes ${NOUNS[metric]}.`
      : e.tier === "premium"
        ? `You've reached ${period} fair-use limit for ${NOUNS[metric]}.`
        : `You've used ${period} free ${NOUNS[metric]}.`;
  return { code: m.reason, metric, tier: e.tier, resetsAt: m.resetsAt, message };
}
