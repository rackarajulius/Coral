import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

/* -------------------------------------------------------------------------- */
/*  Types (mirror of the backend Verification model)                          */
/* -------------------------------------------------------------------------- */

export type VerificationType = "IDENTITY" | "WORK_ELIGIBILITY" | "EXPERIENCE" | "EDUCATION";
export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Verification {
  id: string;
  userId: string;
  type: VerificationType;
  status: VerificationStatus;
  targetId: string | null;
  documentUrl: string | null;
  note: string | null;
  reviewerNote: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVerificationPayload {
  type: VerificationType;
  /** Required for EXPERIENCE / EDUCATION — the UUID of the record to verify. */
  targetId?: string;
  documentUrl?: string;
  note?: string;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

/** Auth header without Content-Type, so the browser sets the multipart boundary. */
async function authHeaderOnly(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({ message: fallback }));
  throw new Error(body.message || fallback);
}

/* -------------------------------------------------------------------------- */
/*  Endpoints                                                                  */
/* -------------------------------------------------------------------------- */

/** POST /verifications — submit a new verification request. */
export async function requestVerification(
  payload: CreateVerificationPayload,
): Promise<Verification> {
  const res = await fetch(`${API_BASE_URL}/verifications`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseError(res, "Failed to submit verification");
  const json = await res.json();
  return json.data as Verification;
}

/**
 * POST /verifications/document — uploads a private verification document and
 * returns its storage reference, to be passed back as `documentUrl` on the
 * matching {@link requestVerification} call.
 */
export async function uploadVerificationDocument(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE_URL}/verifications/document`, {
    method: "POST",
    headers: await authHeaderOnly(),
    body: form,
  });
  if (!res.ok) await parseError(res, "Failed to upload document");
  const json = await res.json();
  return json.data?.documentUrl as string;
}

/* ---- Work-email verification ------------------------------------------- */

export interface WorkEmailStartResult {
  /** Masked, so the page can say where the code went without printing it. */
  sentTo: string;
  expiresAt: string;
}

export interface WorkEmailConfirmResult {
  experienceId: string;
  domain: string;
  /** True when the domain was tied to this employer, so the badge is earned. */
  verified: boolean;
  message: string;
}

/**
 * POST /verifications/work-email/start — emails a code to a work address.
 *
 * The free alternative to an identity check: nothing is paid per attempt and
 * nobody reviews it by hand.
 */
export async function startWorkEmailVerification(
  experienceId: string,
  email: string,
): Promise<WorkEmailStartResult> {
  const res = await fetch(`${API_BASE_URL}/verifications/work-email/start`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ experienceId, email }),
  });
  if (!res.ok) await parseError(res, "Could not send the code");
  const json = await res.json();
  return json.data as WorkEmailStartResult;
}

/** POST /verifications/work-email/confirm — the code settles the role. */
export async function confirmWorkEmailVerification(
  experienceId: string,
  code: string,
): Promise<WorkEmailConfirmResult> {
  const res = await fetch(`${API_BASE_URL}/verifications/work-email/confirm`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ experienceId, code }),
  });
  if (!res.ok) await parseError(res, "Could not confirm the code");
  const json = await res.json();
  return json.data as WorkEmailConfirmResult;
}

/** GET /verifications/me — list the current user's verification requests. */
export async function listMyVerifications(): Promise<Verification[]> {
  const res = await fetch(`${API_BASE_URL}/verifications/me`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await parseError(res, "Failed to load verifications");
  const json = await res.json();
  return (json.data ?? []) as Verification[];
}

/** DELETE /verifications/:id — withdraw a pending request. */
export async function withdrawVerification(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/verifications/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) await parseError(res, "Failed to withdraw verification");
}

/* -------------------------------------------------------------------------- */
/*  Admin endpoints                                                            */
/* -------------------------------------------------------------------------- */

export interface VerificationUser {
  id: string;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

export interface AdminVerification extends Verification {
  user: VerificationUser;
}

export interface AdminVerificationsQuery {
  status?: VerificationStatus;
  type?: VerificationType;
  page?: number;
  limit?: number;
}

export interface PaginatedVerifications {
  data: AdminVerification[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** GET /admin/verifications — paginated review queue (oldest pending first). */
export async function adminListVerifications(
  query: AdminVerificationsQuery = {},
): Promise<PaginatedVerifications> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.type) params.set("type", query.type);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();

  const res = await fetch(`${API_BASE_URL}/admin/verifications${qs ? `?${qs}` : ""}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await parseError(res, "Failed to load verifications");
  const json = await res.json();
  return { data: (json.data ?? []) as AdminVerification[], meta: json.meta };
}

/** GET /admin/verifications/:id/document — mint a short-lived signed URL to view the document. */
export async function getVerificationDocumentUrl(id: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/admin/verifications/${id}/document`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await parseError(res, "Failed to load document");
  const json = await res.json();
  return json.data?.url as string;
}

/** PATCH /admin/verifications/:id/review — approve or reject a request. */
export async function reviewVerification(
  id: string,
  dto: { status: "APPROVED" | "REJECTED"; reviewerNote?: string },
): Promise<Verification> {
  const res = await fetch(`${API_BASE_URL}/admin/verifications/${id}/review`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(dto),
  });
  if (!res.ok) await parseError(res, "Failed to review verification");
  const json = await res.json();
  return json.data as Verification;
}

/* -------------------------------------------------------------------------- */
/*  Derived helpers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Resolves the effective status of a verification type from a list, preferring
 * the most "trusted" active record: APPROVED > PENDING > REJECTED > none.
 * Only an APPROVED result should ever render a verified badge.
 */
export function statusForType(
  verifications: Verification[],
  type: VerificationType,
  targetId?: string,
): VerificationStatus | null {
  const matches = verifications.filter(
    (v) => v.type === type && (targetId ? v.targetId === targetId : !v.targetId),
  );
  if (matches.some((v) => v.status === "APPROVED")) return "APPROVED";
  if (matches.some((v) => v.status === "PENDING")) return "PENDING";
  if (matches.some((v) => v.status === "REJECTED")) return "REJECTED";
  return null;
}
