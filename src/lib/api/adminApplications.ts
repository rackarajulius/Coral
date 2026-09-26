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

async function send(path: string, method: "PATCH" | "DELETE", body?: unknown): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: await authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Action failed");
  }
}

/** UI status label → stored application status. */
const STORED_STATUS: Record<string, string> = {
  "Under Review": "pending",
  Shortlisted: "shortlisted",
  Interview: "interview",
  Rejected: "rejected",
  Withdrawn: "withdrawn",
  Flagged: "flagged",
  Submitted: "pending",
};

/** Sets an application's status from the admin UI vocabulary. */
export const setApplicationStatus = (id: string, uiStatus: string) =>
  send(`/admin/applications/${id}/status`, "PATCH", { status: STORED_STATUS[uiStatus] ?? "pending" });

export const deleteApplication = (id: string) => send(`/admin/applications/${id}`, "DELETE");
