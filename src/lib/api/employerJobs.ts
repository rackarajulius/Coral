import supabase from "@/lib/supabase";
import type { Job, JobStatus } from "@/stores/jobsStore";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

export type BackendJobStatus = "draft" | "active" | "paused" | "closed" | "archived";

export interface BackendJob {
  id: string;
  title: string;
  status: BackendJobStatus;
  location: string | null;
  category: string | null;
  employmentType: string;
  applicationsCount: number;
  viewsCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    applications: number;
    savedBy: number;
  };
}

export const BACKEND_TO_UI_STATUS: Record<BackendJobStatus, JobStatus> = {
  draft: "Draft",
  active: "Open",
  paused: "Paused",
  closed: "Closed",
  archived: "Archived",
};

export const UI_TO_BACKEND_STATUS: Record<JobStatus, BackendJobStatus> = {
  Draft: "draft",
  Open: "active",
  Paused: "paused",
  Closed: "closed",
  Archived: "archived",
};

export function mapBackendJobToUiJob(job: BackendJob, existing?: Job): Job {
  const postedDate = job.publishedAt ?? job.createdAt;
  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 86_400_000),
  );

  return {
    id: job.id,
    title: job.title,
    status: BACKEND_TO_UI_STATUS[job.status],
    applicants: job._count.applications,
    activeCandidates: existing?.activeCandidates ?? 0,
    openInterviews: existing?.openInterviews ?? 0,
    location: job.location ?? "",
    department: job.category ?? "",
    posted: postedDate.slice(0, 10),
    closedAt: job.status === "closed" ? job.updatedAt.slice(0, 10) : undefined,
    closeReason: existing?.closeReason,
    type: job.employmentType,
    recruiter: existing?.recruiter,
    ageDays,
  };
}

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({ message: fallback }));
  throw new Error(body.message || fallback);
}

export async function listMyJobs(): Promise<BackendJob[]> {
  const res = await fetch(`${API_BASE_URL}/jobs/me?limit=100`, {
    headers: await authHeaders(),
  });

  if (!res.ok) {
    return parseError(res, "Failed to load jobs");
  }

  const json = await res.json();
  return json.data;
}

export interface UpdateJobStatusOptions {
  reason?: string;
  notifyApplicants?: boolean;
}

export async function updateJobStatus(
  id: string,
  status: BackendJobStatus,
  opts: UpdateJobStatusOptions = {},
): Promise<BackendJob> {
  const res = await fetch(`${API_BASE_URL}/jobs/${id}/status`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ status, ...opts }),
  });

  if (!res.ok) {
    return parseError(res, "Failed to update job status");
  }

  const json = await res.json();
  return json.data.job;
}

/**
 * The full job, for the edit form.
 *
 * The list shapes (`BackendJob`, the store's `Job`) carry only what a table
 * row needs, so the edit page could never populate description, skills, salary
 * or work arrangement from them — it rendered those fields blank and silently
 * discarded whatever was typed.
 */
export interface FullJob {
  id: string;
  title: string;
  description: string;
  status: BackendJobStatus;
  location: string | null;
  category: string | null;
  employmentType: string;
  experienceLevel: string | null;
  isRemote: boolean;
  isHybrid: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string | null;
  skills: string[];
  benefits: string[];
  responsibilities: string[];
  requirements: string[];
  applicationDeadline: string | null;
  applicationMethod: string;
  applicationUrl: string | null;
  applicationEmail: string | null;
}

/**
 * Loads the whole job for editing.
 *
 * Uses the management snapshot rather than `GET /jobs/:id`: that endpoint
 * increments `viewsCount`, so opening your own job to edit it would inflate
 * your own analytics. This one is ownership-checked and read-only.
 */
export async function getJobForEdit(id: string): Promise<FullJob> {
  const res = await fetch(`${API_BASE_URL}/jobs/${id}/management`, {
    headers: await authHeaders(),
  });
  if (!res.ok) return parseError(res, "Failed to load job");
  return (await res.json()).data.job as FullJob;
}

export interface PatchJobPayload {
  title?: string;
  description?: string;
  location?: string;
  category?: string;
  employmentType?: string;
  experienceLevel?: string;
  isRemote?: boolean;
  isHybrid?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  skills?: string[];
  benefits?: string[];
  applicationDeadline?: string;
  applicationMethod?: string;
  applicationUrl?: string;
  applicationEmail?: string;
  status?: BackendJobStatus;
}

export async function patchJob(id: string, payload: PatchJobPayload): Promise<BackendJob> {
  const res = await fetch(`${API_BASE_URL}/jobs/${id}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return parseError(res, "Failed to update job");
  }

  const json = await res.json();
  return json.data;
}

export async function deleteJobApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/jobs/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });

  if (!res.ok) {
    return parseError(res, "Failed to delete job");
  }
}

export async function duplicateJobApi(id: string, title?: string): Promise<BackendJob> {
  const res = await fetch(`${API_BASE_URL}/jobs/${id}/duplicate`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ title, status: "draft" }),
  });

  if (!res.ok) {
    return parseError(res, "Failed to duplicate job");
  }

  const json = await res.json();
  return json.data;
}
