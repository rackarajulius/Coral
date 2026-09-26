import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: await authHeaders() });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.message || body?.error?.message || message;
    } catch {
      /* no body */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()).data as T;
}

/* ─── Job seeker ─────────────────────────────────────────────────────────── */

export interface RecommendedJob {
  jobId: string;
  title: string;
  company: string;
  companyLogo: string | null;
  location: string | null;
  isRemote: boolean;
  score: number;
  /** Why it was picked, in the words the seeker is shown. */
  reasons: string[];
  /** On top because the employer paid for reach. Always labelled as such. */
  promoted: boolean;
  publishedAt: string | null;
}

export const getRecommendedJobs = (limit = 10) =>
  request<{ items: RecommendedJob[]; needsProfile: boolean }>(`/recommendations/jobs?limit=${limit}`);

/** Fire-and-forget: a failed report must never get in the way of opening the job. */
export function reportRecommendationOpened(jobId: string): void {
  void request(`/recommendations/jobs/${jobId}/opened`, { method: "POST" }).catch(() => undefined);
}

export const dismissRecommendation = (jobId: string) =>
  request<void>(`/recommendations/jobs/${jobId}/dismiss`, { method: "POST" });

export const undismissRecommendation = (jobId: string) =>
  request<void>(`/recommendations/jobs/${jobId}/dismiss`, { method: "DELETE" });

/* ─── Employer ───────────────────────────────────────────────────────────── */

export interface BoostSummary {
  id: string;
  jobId: string;
  status: "active" | "ended";
  startsAt: string;
  endsAt: string;
  secondWaveAt: string | null;
  endedAt: string | null;
}

export interface BoostAllowance {
  used: number;
  /** Null is unlimited, not zero. */
  limit: number | null;
  /** False while billing enforcement is off: over the allowance still works. */
  enforced: boolean;
  periodStart: string;
  periodEnd: string | null;
}

export interface JobReach {
  jobId: string;
  title: string;
  status: string;
  /** Sent in a recommendation digest. */
  delivered: number;
  /** Of those, reached because of a boost. */
  deliveredByBoost: number;
  /** Matched, waiting for the person's next daily digest. */
  queued: number;
  opened: number;
  /** Applied after opening it from a recommendation. */
  applied: number;
  dismissed: number;
  boost: BoostSummary | null;
}

export const getRecommendationReach = () =>
  request<{ jobs: JobReach[]; allowance: BoostAllowance }>(`/employers/recommendations/reach`);

export const startBoost = (jobId: string) =>
  request<{ boost: BoostSummary; queued: number; allowance: BoostAllowance & { overAllowance: boolean } }>(
    `/employers/recommendations/jobs/${jobId}/boost`,
    { method: "POST" },
  );

export const endBoost = (boostId: string) =>
  request<BoostSummary>(`/employers/recommendations/boosts/${boostId}/end`, { method: "POST" });

/* ─── Email preferences (public) ─────────────────────────────────────────── */

export async function unsubscribeFromEmail(params: { u: string; t: string; s: string }) {
  const res = await fetch(`${API_BASE_URL}/email-preferences/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || "This unsubscribe link didn't work.");
  return body.data as { topic: string; unsubscribed: boolean };
}
