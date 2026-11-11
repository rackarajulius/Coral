import supabase from "@/lib/supabase";
import { deleteAccountAsAdmin } from "./accountDeletion";

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

async function send(path: string, method: "PATCH" | "DELETE"): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`, { method, headers: await authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Action failed");
  }
}

/** Admin jobseeker actions. `id` is the jobseeker's User UUID. */
export const suspendJobseeker = (id: string) => send(`/admin/jobseekers/${id}/suspend`, "PATCH");
export const activateJobseeker = (id: string) => send(`/admin/jobseekers/${id}/activate`, "PATCH");
export const banJobseeker = (id: string) => send(`/admin/jobseekers/${id}/ban`, "PATCH");
/** Deletes the account. One account can act for a company, so its companies are handed over or deactivated. */
export const deleteJobseekerAccount = (id: string) => deleteAccountAsAdmin(`/admin/jobseekers/${id}`);
export const deleteJobseeker = async (id: string): Promise<void> => { await deleteJobseekerAccount(id); };

/** Where a report about someone's content came from. */
export type ReportSource = "posts" | "comments" | "profile" | "reviews" | "listings" | "requests";
/** `reviewed`: the marketplace queues record that an admin looked, not what was decided. */
export type ReportOutcome = "open" | "upheld" | "dismissed" | "reviewed";

/** A person's moderation record — facts and counts, never a score. */
export interface JobseekerModerationRecord {
  reports: { source: ReportSource; open: number; upheld: number; dismissed: number; reviewed: number }[];
  recent: { source: ReportSource; outcome: ReportOutcome; reason: string; createdAt: string }[];
  removed: { posts: number; comments: number; reviews: number; listings: number };
  accountActions: { summary: string; at: string; by: string }[];
  identity: { status: "PENDING" | "APPROVED" | "REJECTED"; at: string } | null;
}

/** Countries stored on job-seeker profiles (codes like "CA"), with how many people each. */
export async function getJobseekerCountries(): Promise<{ code: string; people: number }[]> {
  const res = await fetch(`${API_BASE_URL}/admin/jobseekers/countries`, { headers: await authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || "Couldn't load countries");
  return body.data;
}

/** "CA" → "Canada", via the browser — no country table to maintain. Falls back to the code. */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export async function getJobseekerModeration(id: string): Promise<JobseekerModerationRecord> {
  const res = await fetch(`${API_BASE_URL}/admin/jobseekers/${id}/moderation`, { headers: await authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || "Couldn't load the moderation record");
  return body.data;
}

/**
 * A five-minute link to the person's stored résumé. The server writes an
 * audit entry on every call, so fetch it only when the admin asks to open it.
 */
export async function getJobseekerResumeLink(id: string): Promise<{ url: string; fileName: string | null }> {
  const res = await fetch(`${API_BASE_URL}/admin/jobseekers/${id}/resume`, { headers: await authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || "Couldn't open the résumé");
  return body.data;
}

/* ------------------------------ Premium comps ------------------------------ */

/** What the admin sees before granting or revoking. Dates are ISO strings. */
export interface AdminJobseekerPremium {
  tier: "free" | "premium";
  paid: {
    active: boolean;
    status: "NONE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
    interval: "MONTHLY" | "YEARLY" | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
  comp: {
    active: boolean;
    until: string | null;
    reason: string | null;
    grantedBy: string | null;
  };
}

async function premiumRequest(id: string, init: RequestInit = {}): Promise<AdminJobseekerPremium> {
  const res = await fetch(`${API_BASE_URL}/admin/jobseekers/${id}/premium`, {
    ...init,
    headers: await authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (body as { message?: string | string[] }).message;
    throw new Error((Array.isArray(message) ? message[0] : message) || "Action failed");
  }
  return (body as { data: AdminJobseekerPremium }).data;
}

export const getJobseekerPremium = (id: string) => premiumRequest(id);

/** Premium without payment until `until`. The person is told by email and in the app. */
export const grantJobseekerPremium = (id: string, until: Date, reason: string) =>
  premiumRequest(id, { method: "POST", body: JSON.stringify({ until: until.toISOString(), reason }) });

/** Ends the comp now. A paid subscription is left alone. */
export const revokeJobseekerPremium = (id: string) => premiumRequest(id, { method: "DELETE" });
