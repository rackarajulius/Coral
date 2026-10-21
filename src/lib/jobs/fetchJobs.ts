import type {
  Award, CoreValue, DeiStat, GalleryPhoto, Job, WhyCard,
} from "@/data/jobs";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

function formatSalary(job: Record<string, unknown>): string {
  const min = job.salaryMin as number | null;
  const max = job.salaryMax as number | null;
  const cur = ((job.salaryCurrency as string) ?? "USD").toUpperCase();
  const sym = ({ USD: "$", EUR: "€", GBP: "£", CAD: "C$" } as Record<string, string>)[cur] ?? cur;
  const period = job.salaryPeriod === "hourly" ? "/hr" : job.salaryPeriod === "monthly" ? "/mo" : "/yr";
  const fmt = (n: number) => (n >= 1000 ? `${sym}${Math.round(n / 1000)}k` : `${sym}${n}`);
  if (min && max) return `${fmt(min)} – ${fmt(max)}${period}`;
  if (min) return `${fmt(min)}+${period}`;
  if (max) return `Up to ${fmt(max)}${period}`;
  return "";
}

/** The employer's own company info, when their profile has any. */
/** Json columns arrive as `unknown`; anything not an array is treated as absent. */
function jsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function mapCompanyProfile(job: Record<string, unknown>) {
  const posted = job.postedBy as { employerProfile?: Record<string, unknown> } | undefined;
  const p = posted?.employerProfile;
  if (!p) return null;
  return {
    id: (p.id as string) ?? null,
    tagline: (p.tagline as string) ?? null,
    description: (p.companyDescription as string) ?? null,
    website: (p.companyWebsite as string) ?? null,
    industry: (p.industry as string) ?? null,
    size: (p.companySize as string) ?? null,
    headquarters: (p.headquarters as string) ?? null,
    foundedYear: (p.foundedYear as number) ?? null,
    culture: (p.companyCulture as string) ?? null,
    benefits: Array.isArray(p.companyBenefits) ? (p.companyBenefits as string[]) : [],
    /** Human-approved, so it is worth a badge. Anything else is unverified. */
    verified: p.verificationStatus === "verified",
    /**
     * Brand content. Only the job *detail* endpoint returns these, so on a
     * list row they are simply absent — which the card handles the same way
     * it handles an employer who never filled them in.
     */
    mission: (p.mission as string) ?? null,
    whyWorkHere: jsonArray<WhyCard>(p.whyWorkHere),
    coreValues: jsonArray<CoreValue>(p.coreValues),
    awards: jsonArray<Award>(p.awards),
    diversityStatement: (p.diversityStatement as string) ?? null,
    deiStats: jsonArray<DeiStat>(p.deiStats),
    galleryPhotos: jsonArray<GalleryPhoto>(p.galleryPhotos),
  };
}

function formatPostedAt(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function transformBackendJob(job: Record<string, unknown>): Job {
  const poster = job.postedBy as Record<string, unknown> | null;
  const employerProfile = poster?.employerProfile as Record<string, unknown> | null | undefined;
  const company =
    (job.companyName as string) ||
    (employerProfile?.companyName as string) ||
    (poster?.displayName as string) ||
    [poster?.firstName, poster?.lastName].filter(Boolean).join(" ") ||
    "Unknown";
  const icon =
    (job.companyLogo as string) ||
    (employerProfile?.companyLogo as string) ||
    (poster?.avatarUrl as string) ||
    "";
  const isRemote = Boolean(job.isRemote);
  const rawLocation = (job.location as string) ?? "";
  const location = isRemote
    ? rawLocation ? `${rawLocation} (Remote)` : "Remote"
    : rawLocation;

  return {
    id: job.id as string,
    title: job.title as string,
    company,
    icon,
    location,
    type: (job.employmentType as string) ?? (job.jobType as string) ?? "",
    salary: formatSalary(job),
    description: (job.description as string) ?? "",
    responsibilities: Array.isArray(job.responsibilities) ? (job.responsibilities as string[]) : [],
    requirements: Array.isArray(job.requirements) ? (job.requirements as string[]) : [],
    benefits: Array.isArray(job.benefits) ? (job.benefits as string[]) : [],
    tags: Array.isArray(job.skills) ? (job.skills as string[]) : [],
    postedAt: formatPostedAt(job.createdAt as string),
    applicationMethod: (job.applicationMethod as "internal" | "external" | "email") ?? "internal",
    applicationUrl: (job.applicationUrl as string | null) ?? null,
    applicationEmail: (job.applicationEmail as string | null) ?? null,
    companyProfile: mapCompanyProfile(job),
    existingVacancy: typeof job.existingVacancy === "boolean" ? job.existingVacancy : null,
    usesAi: job.usesAi === true,
  };
}

export interface FetchJobsParams {
  /** Free-text search — matched server-side against title, description and skills. */
  query?: string;
  location?: string;
  limit?: number;
}

/**
 * Public job search against the real backend `/jobs` endpoint. `query` and
 * `location` are handled server-side; results come back already filtered.
 */
export async function fetchPublicJobs(params: FetchJobsParams = {}): Promise<Job[]> {
  const sp = new URLSearchParams();
  if (params.query?.trim()) sp.set("query", params.query.trim());
  if (params.location?.trim()) sp.set("location", params.location.trim());
  sp.set("limit", String(params.limit ?? 100));

  const res = await fetch(`${API_BASE_URL}/jobs?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to load jobs");
  const { data } = await res.json();
  return ((data ?? []) as Record<string, unknown>[]).map(transformBackendJob);
}

/**
 * One job, with the employer's brand content attached.
 *
 * The list endpoint deliberately omits that content — it is large and only the
 * detail view renders it — so a job taken from a list row has empty brand
 * fields. Anything that needs them must ask for the job by id.
 */
export async function fetchPublicJobById(id: string): Promise<Job> {
  const res = await fetch(`${API_BASE_URL}/jobs/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("Failed to load job");
  const json = await res.json();
  return transformBackendJob(json.data as Record<string, unknown>);
}
