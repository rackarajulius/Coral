import supabase from "@/lib/supabase";
import { errorFromBody } from "./entitlementError";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

export interface ParsedResumeExperience {
  title: string;
  company: string;
  location: string;
  period: string;
  description: string;
}

export interface ParsedResumeEducation {
  degree: string;
  school: string;
  location: string;
  period: string;
  description: string;
}

export interface ParsedResumeProfile {
  name: string;
  headline: string;
  summary: string;
  skills: string[];
  languages: string[];
  experiences: ParsedResumeExperience[];
  educations: ParsedResumeEducation[];
}

export type EmploymentType = "full_time" | "part_time" | "contract" | "temporary" | "internship";
export type Workplace = "remote" | "hybrid" | "onsite";

/** A matched job (Phase 1+). */
export interface MatchedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  source: "platform" | "adzuna" | "jsearch" | "talent" | "greenhouse" | "lever" | "ashby" | string;
  matchScore: number;
  /** Optional for compatibility with older API responses. */
  scoringMode?: "ai" | "heuristic";
  reason?: string;
  url?: string;
  salary?: string;
  description?: string;
  /** The employer's logo, when there is a real one. */
  logoUrl?: string;
  /** Where the listing was published, when known; `isEmployer` for the company's own site. */
  publishedOn?: { name: string; isEmployer: boolean };
  /** When it was posted (ISO), when the source says. */
  postedAt?: string;
  employmentType?: EmploymentType;
  /** Only when the listing says; unknown is left out. */
  workplace?: Workplace;
  /** Pay as a yearly range, for sorting and filtering. */
  yearlyPay?: { min?: number; max?: number; currency?: string };
}

export interface JobContext {
  title: string;
  company: string;
  location?: string;
  description?: string;
}

export interface CoverLetterResult {
  coverLetter: string;
}

export interface ResumeTailoring {
  tailoredSummary: string;
  emphasizedSkills: string[];
  suggestions: string[];
  keywordsToAdd: string[];
}

export interface CompanyResearchProfile {
  summary: string;
  industry: string;
  size: string;
  headquarters: string;
  highlights: string[];
  culture: string[];
  interviewQuestions: string[];
}

export interface CompanyResearchResult {
  configured: boolean;
  profile: CompanyResearchProfile | null;
  sources: { title: string; url: string }[];
}

export interface MatchRunResult {
  /** false when the seeker hasn't completed a profile yet. */
  hasProfile: boolean;
  /** The role query actually used (derived from the profile, or the search term). */
  query: string;
  /** Where was searched: the profile's city at first, "" for anywhere. */
  location?: string;
  /** That place's country (ISO code), when known. */
  countryCode?: string;
  /** The person's own country (ISO code): what an empty location box searches. */
  homeCountryCode?: string;
  /** The role as local job ads write it ("Pflegefachkraft"), searched as well, and that language ("German"). */
  localQuery?: string;
  localLanguage?: string;
  matches: MatchedJob[];
  /**
   * What was searched. `platform` means only jobs posted here; web sources
   * join with Premium.
   */
  scope: "platform" | "web";
  /** Why web results were withheld, when they were. Null otherwise. */
  webBlockedReason: "PREMIUM_REQUIRED" | "ALLOWANCE_EXHAUSTED" | null;
  /** Sources asked for jobs. Optional for compatibility with older API responses. */
  searchedSources?: string[];
  /** Sources that could not be reached on this search. */
  unavailableSources?: string[];
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

/** Whether the current user can run the matcher (premium). Drives the upsell gate. */
export async function getResumeMatcherAccess(): Promise<{ isPremium: boolean }> {
  const res = await fetch(`${API_BASE_URL}/resume-matcher/access`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to check access");
  const json = await res.json();
  return { isPremium: !!json.data?.isPremium };
}

/**
 * Matches the seeker's stored profile to jobs. Pass an optional role/keyword
 * (from the search bar) to search for something specific instead.
 */
/** "Not interested": the matcher leaves this job out from now on. */
export async function dismissMatch(job: { jobId: string; title: string; company: string }): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/resume-matcher/dismissed`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(job),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw errorFromBody(body, "Couldn't hide that job");
  }
}

/** Undo for "not interested". */
export async function undismissMatch(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/resume-matcher/dismissed?jobId=${encodeURIComponent(jobId)}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw errorFromBody(body, "Couldn't bring that job back");
  }
}

/** What to search for. Omitted fields fall back to the profile; an empty `location` means anywhere. */
export interface MatchSearch {
  query?: string;
  location?: string;
  /** The picked city's country (ISO code), when it came from suggestions. */
  countryCode?: string;
}

export async function runResumeMatch(search?: MatchSearch, signal?: AbortSignal): Promise<MatchRunResult> {
  const body: MatchSearch = {};
  if (search?.query) body.query = search.query;
  if (search?.location !== undefined) body.location = search.location;
  if (search?.countryCode) body.countryCode = search.countryCode;
  const res = await fetch(`${API_BASE_URL}/resume-matcher/run`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw errorFromBody(body, "Failed to run matcher");
  }
  const json = await res.json();
  return json.data as MatchRunResult;
}

/** Drafts a cover letter for a job using the seeker's stored profile (premium). */
export async function generateCoverLetter(job: JobContext): Promise<CoverLetterResult> {
  const res = await fetch(`${API_BASE_URL}/resume-matcher/cover-letter`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ job }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw errorFromBody(body, "Failed to generate cover letter");
  }
  return (await res.json()).data as CoverLetterResult;
}

/** Tailors the stored profile/resume to a job (premium). */
export async function tailorResume(job: JobContext): Promise<ResumeTailoring> {
  const res = await fetch(`${API_BASE_URL}/resume-matcher/tailor`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ job }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw errorFromBody(body, "Failed to tailor resume");
  }
  return (await res.json()).data as ResumeTailoring;
}

/** Researches the company behind a listing using real web sources (premium). */
export async function researchCompany(
  company: string,
  jobTitle?: string,
): Promise<CompanyResearchResult> {
  const res = await fetch(`${API_BASE_URL}/resume-matcher/company-research`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ company, jobTitle }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw errorFromBody(body, "Failed to research company");
  }
  return (await res.json()).data as CompanyResearchResult;
}
