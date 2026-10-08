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

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/${path}`, { ...init, headers: await authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Request failed");
  }
  return (await res.json()).data as T;
}

/** An interaction the signed-in candidate could review but hasn't yet. */
export interface Reviewable {
  kind: "application" | "interview";
  id: string;
  employerId: string;
  company: string;
  role: string;
  stageReached: string;
  at: string | null;
}

export interface CategoryRatings {
  communication?: number;
  clarity?: number;
  respect?: number;
  timeliness?: number;
}

export interface CreateReviewInput {
  applicationId?: string;
  interviewId?: string;
  rating: number;
  title: string;
  body: string;
  categoryRatings?: CategoryRatings;
}

export interface CreateReviewResult {
  id: string;
  status: "published" | "pending";
  /** Set when held back — what the automated checks caught. */
  pendingReason: string | null;
}

export interface MyReview {
  id: string;
  company: string;
  rating: number;
  title: string;
  body: string;
  status: string;
  createdAt: string;
  response: { body: string; at: string } | null;
}

/** Public review summary for a company. Contains no reviewer identity. */
export interface CompanyReviews {
  total: number;
  /** Null when nothing is rated — never 0, which would read as "rated badly". */
  averageRating: number | null;
  distribution: { star: number; count: number }[];
  categoryAverages: Record<string, number | null>;
  /** True while the company has too few reviews to show per-review context. */
  contextHidden: boolean;
  contextNote: string | null;
  reviews: {
    id: string;
    rating: number;
    title: string;
    body: string;
    categoryRatings: Record<string, number> | null;
    publishedAt: string | null;
    /** Null while context is hidden. */
    stageReached: string | null;
    response: { body: string; at: string } | null;
  }[];
}

/** Public — no auth needed, since this is read before deciding to apply. */
export async function getCompanyReviews(employerId: string): Promise<CompanyReviews> {
  const res = await fetch(`${API_BASE_URL}/reviews/companies/${encodeURIComponent(employerId)}`);
  if (!res.ok) throw new Error("Failed to load reviews");
  return (await res.json()).data as CompanyReviews;
}

export const getReviewable = () => req<Reviewable[]>("reviews/reviewable");
export const getMyReviews = () => req<MyReview[]>("reviews/mine");

export const createReview = (input: CreateReviewInput) =>
  req<CreateReviewResult>("reviews", { method: "POST", body: JSON.stringify(input) });

/* -------------------------------- employer -------------------------------- */

/**
 * The employer's own reviews. Same shape and same anonymity as the public
 * view — they get no privileged access to who wrote what.
 */
export const getEmployerReviews = () => req<CompanyReviews>("employers/reviews");

export interface EmployerReviewOverview {
  total: number;
  averageRating: number | null;
  distribution: { star: number; count: number }[];
  categoryAverages: Record<string, number | null>;
  responded: number;
  unanswered: number;
  responseRate: number | null;
  averageResponseHours: number | null;
  monthly: { month: string; count: number; averageRating: number | null }[];
}

export const getEmployerReviewOverview = () =>
  req<EmployerReviewOverview>("employers/reviews/overview");

/** Right of reply. There is no employer delete — by design, not by omission. */
export const respondToReview = (reviewId: string, body: string) =>
  req<{ id: string; body: string; at: string }>(`employers/reviews/${reviewId}/respond`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });

/** Reports a review for moderation. Never hides it — only a moderator can. */
export const flagReview = (reviewId: string, reason: string, detail?: string) =>
  req<{ flagged: boolean }>(`reviews/${reviewId}/flag`, {
    method: "POST",
    body: JSON.stringify({ reason, detail }),
  });

/* ------------------------------ moderation ------------------------------- */

export interface QueuedReview {
  id: string;
  company: string;
  rating: number;
  title: string;
  body: string;
  stageReached: string;
  status: string;
  /** What the automated checks found, and whether the AI pass actually ran. */
  checkResults: {
    pass: boolean;
    aiChecked: boolean;
    findings: { code: string; detail: string }[];
  } | null;
  createdAt: string;
  flags?: { reason: string; detail: string | null; at: string }[];
}

export const getModerationQueue = () =>
  req<{ pending: QueuedReview[]; flagged: QueuedReview[] }>("admin/reviews/queue");

export const moderateReview = (id: string, action: "publish" | "remove", note?: string) =>
  req<{ id: string; status: string }>(`admin/reviews/${id}/moderate`, {
    method: "POST",
    body: JSON.stringify({ action, note }),
  });

/** Why a review was reported, in words rather than the stored code. */
export const FLAG_REASONS: Record<string, string> = {
  inaccurate: "Says it's inaccurate",
  not_a_real_candidate: "Says this isn't a real candidate",
  personal_details: "Contains personal details",
  abusive: "Abusive",
  other: "Other",
};

/** The four things a hiring process can be rated on. */
export const REVIEW_CATEGORIES: { key: keyof CategoryRatings; label: string; hint: string }[] = [
  { key: "communication", label: "Communication", hint: "Were you kept informed?" },
  { key: "clarity", label: "Clarity", hint: "Was the role and process clear?" },
  { key: "respect", label: "Respect", hint: "Were you treated well?" },
  { key: "timeliness", label: "Timeliness", hint: "Did things happen when promised?" },
];
