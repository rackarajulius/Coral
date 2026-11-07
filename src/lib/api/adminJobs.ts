import supabase from "@/lib/supabase";
import type { AdminJobStatus, AdminSettableJobStatus, Job } from "@/data/admin/job/jobs";

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
 * Admin label → the status stored on the Job.
 *
 * The admin page used to speak a moderation vocabulary — Pending, Flagged,
 * Suspended, Rejected — that has no states behind it. It was mapped onto
 * draft/paused/closed/archived, which read back wrong: every job the expiry
 * cron archived showed as "Rejected", and an employer pausing their own job
 * showed as "Flagged". The labels are now the stored statuses themselves.
 *
 * None of these is moderation the employer can't undo: they can reopen a job
 * an admin paused or closed. Holding a job down needs its own state on the
 * model.
 */
const STORED_STATUS: Record<AdminSettableJobStatus, string> = {
  Active: "active",
  Paused: "paused",
  Closed: "closed",
  Archived: "archived",
};

/**
 * The moves an admin is offered from each status — the employer's own
 * transition graph (jobs.service assertStatusTransition) minus going back to
 * draft, which is the employer's call.
 */
const NEXT_STATUSES: Record<AdminJobStatus, AdminSettableJobStatus[]> = {
  Draft: ["Archived"],
  Active: ["Paused", "Closed", "Archived"],
  Expired: ["Paused", "Closed", "Archived"],
  Paused: ["Active", "Closed", "Archived"],
  Closed: ["Active", "Archived"],
  Archived: ["Active"],
};

/**
 * What an admin can do to this job right now.
 *
 * Activate is withheld once the deadline has passed: search hides the job
 * and the expiry cron would archive it again, so the server refuses it.
 */
export function adminStatusActions(job: Pick<Job, "status" | "deadlinePassed">): AdminSettableJobStatus[] {
  const next = NEXT_STATUSES[job.status] ?? [];
  return job.deadlinePassed ? next.filter((s) => s !== "Active") : next;
}

/** The button label for each move, and what it does, in the admin's words. */
export const STATUS_ACTION_COPY: Record<AdminSettableJobStatus, { label: string; done: string }> = {
  Active: { label: "Activate", done: "is live again" },
  Paused: { label: "Pause", done: "is paused" },
  Closed: { label: "Close", done: "is closed to new applications" },
  Archived: { label: "Archive", done: "is archived" },
};

/** Shown before archiving: what it does, and what it doesn't. */
export const ARCHIVE_EXPLAINER =
  "Archived jobs leave search and stop taking applications. The employer still sees them and can reopen them.";

/**
 * Sets a job's status from the admin UI vocabulary.
 *
 * Unknown labels throw rather than defaulting: silently publishing a job
 * because a label didn't match is how the original bug went unnoticed.
 */
export const setJobStatus = (id: string, uiStatus: AdminSettableJobStatus) => {
  const status = STORED_STATUS[uiStatus];
  if (!status) throw new Error(`Unknown job status: ${uiStatus}`);
  return send(`/admin/jobs/${id}/status`, "PATCH", { status });
};

export const deleteJob = (id: string) => send(`/admin/jobs/${id}`, "DELETE");
