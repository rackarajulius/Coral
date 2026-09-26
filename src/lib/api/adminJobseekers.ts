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
export const deleteJobseeker = (id: string) => send(`/admin/jobseekers/${id}`, "DELETE");

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
