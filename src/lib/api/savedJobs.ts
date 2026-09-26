import supabase from "@/lib/supabase";
import { SavedJob } from "@/data/jobactivity/job-activity-mock";

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

interface BackendSavedJob {
  id: string;
  jobId: string;
  createdAt: string;
  job: {
    id: string;
    title: string;
    companyName: string | null;
    location: string | null;
    isRemote: boolean;
    isHybrid: boolean;
    employmentType: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryCurrency: string | null;
    description: string | null;
    responsibilities: string[];
    benefits: string[];
    skills: string[];
    applicationDeadline: string | null;
    publishedAt: string | null;
    createdAt: string;
    postedBy: {
      employerProfile: {
        industry: string | null;
        companySize: string | null;
        companyDescription: string | null;
        overview: string | null;
      } | null;
    } | null;
  } | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };

function formatSalary(min: number | null, max: number | null, currency: string | null): string {
  if (!min && !max) return "Not disclosed";
  const sym = CURRENCY_SYMBOLS[currency ?? "USD"] ?? "";
  const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);
  if (min && max) return `${sym}${k(min)}–${sym}${k(max)}`;
  return `${sym}${k((min ?? max) as number)}`;
}

function mapType(t: string | null): SavedJob["type"] {
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

const DAY = 86_400_000;

/** Derive a badge from real data only (no fabrication) — else none. */
function deriveBadge(b: BackendSavedJob["job"]): string | undefined {
  if (!b) return undefined;
  if (b.applicationDeadline) {
    const left = new Date(b.applicationDeadline).getTime() - Date.now();
    if (left > 0 && left <= 7 * DAY) return "Closing Soon";
  }
  const posted = b.publishedAt ?? b.createdAt;
  if (posted && Date.now() - new Date(posted).getTime() <= 3 * DAY) return "Recently Posted";
  return undefined;
}

function toSavedJob(s: BackendSavedJob): SavedJob {
  const job = s.job;
  const company = job?.companyName?.trim() || "Company";
  const profile = job?.postedBy?.employerProfile ?? null;

  return {
    // Use jobId as the id — the unsave endpoint accepts it directly.
    id: s.jobId,
    title: job?.title ?? "Role",
    company,
    location: job?.location?.trim() || (job?.isRemote ? "Remote" : "—"),
    salary: formatSalary(job?.salaryMin ?? null, job?.salaryMax ?? null, job?.salaryCurrency ?? null),
    type: mapType(job?.employmentType ?? null),
    posted: relativeTime(s.createdAt),
    badge: deriveBadge(job),
    description: job?.description ?? "",
    responsibilities: job?.responsibilities ?? [],
    benefits: job?.benefits ?? [],
    skills: job?.skills ?? [],
    companyAbout: profile?.companyDescription ?? profile?.overview ?? undefined,
    companyIndustry: profile?.industry ?? undefined,
    companySize: profile?.companySize ?? undefined,
    // `match` intentionally omitted — no matching score is computed server-side.
  };
}

/** The current job seeker's saved jobs, mapped for the activity UI. */
export async function getMySavedJobs(): Promise<SavedJob[]> {
  const res = await fetch(`${API_BASE_URL}/saved-jobs?limit=100`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load saved jobs");
  const json = await res.json();
  return ((json.data ?? []) as BackendSavedJob[]).map(toSavedJob);
}

/** Saves a job to the current user's list (idempotent server-side). */
export async function saveJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/saved-jobs`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ jobId }),
  });
  if (!res.ok) throw new Error("Failed to save job");
}

/** Removes a job from the current user's saved list (accepts the jobId). */
export async function unsaveJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/saved-jobs/${encodeURIComponent(jobId)}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to remove saved job");
}
