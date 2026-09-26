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

/**
 * Admin UI label → the status actually stored on a Job.
 *
 * This map used to invent its own vocabulary — 'published', 'flagged',
 * 'suspended', 'rejected', 'pending' — none of which exist in the schema. Any
 * job an admin touched became invisible on the public site and could not
 * receive applications, because every other query filters on 'active'.
 *
 * The schema's statuses are the only ones written now:
 *   draft | active | paused | closed | archived
 *
 * Note the mapping is lossy in one direction: Flagged and Suspended are
 * different admin intentions that store as paused and closed. Distinguishing
 * them properly needs real moderation states on the model, which is a design
 * decision rather than a mapping.
 */
const STORED_STATUS: Record<string, string> = {
  Active: "active",
  Pending: "draft",
  // Reversible, under review.
  Flagged: "paused",
  // A harder stop than flagged.
  Suspended: "closed",
  Rejected: "archived",
};

/** Stored status → the label the admin UI shows. */
export const UI_STATUS: Record<string, string> = {
  active: "Active",
  draft: "Pending",
  paused: "Flagged",
  closed: "Suspended",
  archived: "Rejected",
};

/**
 * Sets a job's status from the admin UI vocabulary.
 *
 * Unknown labels throw rather than defaulting: silently publishing a job
 * because a label didn't match is how the original bug went unnoticed.
 */
export const setJobStatus = (id: string, uiStatus: string) => {
  const status = STORED_STATUS[uiStatus];
  if (!status) throw new Error(`Unknown job status: ${uiStatus}`);
  return send(`/admin/jobs/${id}/status`, "PATCH", { status });
};

export const deleteJob = (id: string) => send(`/admin/jobs/${id}`, "DELETE");
