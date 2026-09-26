import supabase from "@/lib/supabase";
import { Application, AppStatus, STATUS_META } from "@/data/jobactivity/job-activity-mock";

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

/** Shape returned by the backend for a job seeker's own applications. */
interface BackendApplication {
  id: string;
  status: string;
  appliedAt: string;
  updatedAt: string;
  job: {
    id: string;
    title: string;
    companyName: string | null;
    companyLogo: string | null;
    location: string | null;
    isRemote: boolean;
    isHybrid: boolean;
    employmentType: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryCurrency: string | null;
  } | null;
}

// Backend ApplicationStatus → the activity UI's richer status vocabulary.
const STATUS_MAP: Record<string, AppStatus> = {
  pending: "applied",
  reviewing: "under_review",
  shortlisted: "shortlisted",
  interviewing: "interview_scheduled",
  offered: "offer",
  hired: "hired",
  rejected: "rejected",
  withdrawn: "withdrawn",
};

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };

function formatSalary(min: number | null, max: number | null, currency: string | null): string {
  if (!min && !max) return "Not disclosed";
  const sym = CURRENCY_SYMBOLS[currency ?? "USD"] ?? "";
  const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);
  if (min && max) return `${sym}${k(min)}–${sym}${k(max)}`;
  return `${sym}${k((min ?? max) as number)}`;
}

function mapType(t: string | null): Application["type"] {
  switch ((t ?? "").toLowerCase()) {
    case "part-time":
      return "Part-time";
    case "contract":
    case "freelance":
      return "Contract";
    default:
      return "Full-time";
  }
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diffMs / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/** Maps a backend application to the activity UI's Application shape. */
function toActivityApplication(b: BackendApplication): Application {
  const status = STATUS_MAP[b.status] ?? "applied";
  const job = b.job;
  const company = job?.companyName?.trim() || "Company";
  const appliedDate = b.appliedAt.slice(0, 10);

  // Honest, minimal timeline derived from real timestamps — not fabricated events.
  const timeline: Application["timeline"] = [{ event: "Application submitted", date: appliedDate }];
  if (status !== "applied" && b.updatedAt.slice(0, 10) >= appliedDate) {
    timeline.push({ event: STATUS_META[status].label, date: b.updatedAt.slice(0, 10) });
  }

  return {
    id: b.id,
    job: job?.title ?? "Role",
    company,
    companyLogo: company.charAt(0).toUpperCase(),
    location: job?.location?.trim() || "—",
    remote: job?.isRemote ? "Remote" : job?.isHybrid ? "Hybrid" : "On-site",
    appliedDate,
    status,
    lastActivity: relativeTime(b.updatedAt),
    salary: formatSalary(job?.salaryMin ?? null, job?.salaryMax ?? null, job?.salaryCurrency ?? null),
    type: mapType(job?.employmentType ?? null),
    // Real applications have no designated recruiter contact — omitted (the UI hides it).
    timeline,
  };
}

export interface ApplyInput {
  jobId: string;
  coverLetter?: string;
  expectedSalary?: number;
  availabilityDate?: string;
  /** Resume tailored to this application; omit to use the profile default. */
  resumePath?: string;
}

/**
 * Uploads a resume for one application only — the profile default is left
 * untouched. Returns the storage path to pass to `applyToJob`.
 */
export async function uploadResumeForApplication(
  file: File,
): Promise<{ path: string; fileName: string; url: string | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE_URL}/job-seekers/me/resume/for-application`, {
    method: "POST",
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Couldn't upload that resume");
  }
  return (await res.json()).data;
}

/** Submits an application to a job. Throws with the server's reason on failure. */
export async function applyToJob(input: ApplyInput): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE_URL}/applications`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Couldn't submit your application");
  }
  const json = await res.json();
  return (json.data ?? json) as { id: string };
}

/**
 * Job ids the user has already applied to — lets the UI show an "Applied" state
 * instead of offering a duplicate application the server would reject.
 */
/** The current user's application to one job, as the job page needs it. */
export interface MyJobApplication {
  /** ISO. */
  appliedAt: string;
  /** Backend status: pending, reviewing, …, rejected, withdrawn. */
  status: string;
}

/** Job id → the current user's application. Empty when signed out or on error. */
export async function getMyAppliedJobs(): Promise<Map<string, MyJobApplication>> {
  const res = await fetch(`${API_BASE_URL}/applications/me?limit=100`, {
    headers: await authHeaders(),
  });
  if (!res.ok) return new Map();
  const json = await res.json();
  const applied = new Map<string, MyJobApplication>();
  for (const a of (json.data ?? []) as BackendApplication[]) {
    if (a.job?.id && !applied.has(a.job.id)) {
      applied.set(a.job.id, { appliedAt: a.appliedAt, status: a.status });
    }
  }
  return applied;
}

/** The current job seeker's applications, mapped for the activity UI. */
export async function getMyApplications(): Promise<Application[]> {
  const res = await fetch(`${API_BASE_URL}/applications/me?limit=100`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load applications");
  const json = await res.json();
  return ((json.data ?? []) as BackendApplication[]).map(toActivityApplication);
}

/** Withdraws one of the current user's applications. */
export async function withdrawMyApplication(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/applications/${encodeURIComponent(id)}/withdraw`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to withdraw application");
}
