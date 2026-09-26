import supabase from "@/lib/supabase";
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

export interface PublicJob {
  id: string;
  title: string;
  status: string;
  location: string | null;
  category: string | null;
  employmentType: string;
  isRemote: boolean;
  isHybrid: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface ListJobsParams {
  postedById?: string;
  limit?: number;
  sort?: "newest" | "oldest" | "salary_asc" | "salary_desc";
}

interface ListJobsResponse {
  success: boolean;
  data: PublicJob[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Public job listing (no auth required). The backend always restricts this to active jobs. */
export async function listPublicJobs(params: ListJobsParams = {}): Promise<PublicJob[]> {
  const search = new URLSearchParams();
  if (params.postedById) search.set("postedById", params.postedById);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.sort) search.set("sort", params.sort);

  const qs = search.toString();
  const res = await fetch(`${API_BASE_URL}/jobs${qs ? `?${qs}` : ""}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Failed to load jobs" }));
    throw new Error(body.message || "Failed to load jobs");
  }

  const json: ListJobsResponse = await res.json();
  return json.data;
}

/* ─── AI match scores ────────────────────────────────────────────────────── */

export interface JobMatch {
  jobId: string;
  /** 0-100, or null when there's no profile signal to judge on. */
  score: number | null;
  reason: string | null;
}

/**
 * AI fit scores for the jobs currently on screen. Returns [] when signed out —
 * matching is a personalised feature, so anonymous browsing simply omits it.
 */
export async function matchJobs(jobIds: string[]): Promise<JobMatch[]> {
  if (jobIds.length === 0) return [];
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return [];

  const res = await fetch(`${API_BASE_URL}/jobs/match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ jobIds: jobIds.slice(0, 30) }),
  });
  if (!res.ok) return [];
  return ((await res.json()).data ?? []) as JobMatch[];
}

/* ─── Fit breakdown + resume tailoring (job details) ─────────────────────── */

export interface JobFit {
  matchedSkills: string[];
  missingSkills: string[];
  verdict: string | null;
  gaps: string[];
  jobListsNoSkills: boolean;
  noProfileSignal: boolean;
}

export interface ResumeTailoring {
  tailoredSummary: string;
  emphasizedSkills: string[];
  suggestions: string[];
  keywordsToAdd: string[];
}

async function authed(): Promise<HeadersInit | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
}

/** Matched/missing skills for one job. Null when signed out. */
export async function getJobFit(jobId: string): Promise<JobFit | null> {
  const headers = await authed();
  if (!headers) return null;
  const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/fit`, { headers });
  if (!res.ok) return null;
  return (await res.json()).data as JobFit;
}

/** Rewrites the stored resume toward this job. Throws the server's reason. */
export async function tailorResumeForJob(jobId: string): Promise<ResumeTailoring> {
  const headers = await authed();
  if (!headers) throw new Error("Sign in to tailor your resume");
  const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/tailor-resume`, {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Couldn't tailor your resume");
  }
  return (await res.json()).data as ResumeTailoring;
}

/* ─── Company research ───────────────────────────────────────────────────── */

export interface CompanyResearch {
  /** false when Firecrawl isn't configured — the UI says so instead of faking. */
  configured: boolean;
  profile: {
    summary: string;
    industry: string;
    size: string;
    headquarters: string;
    highlights: string[];
    culture: string[];
    interviewQuestions: string[];
  } | null;
  sources: { title: string; url: string }[];
}

/** What this company is like, summarised from real web sources (cited). */
export async function getCompanyResearch(jobId: string): Promise<CompanyResearch | null> {
  const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/company-research`);
  if (!res.ok) return null;
  return (await res.json()).data as CompanyResearch;
}
