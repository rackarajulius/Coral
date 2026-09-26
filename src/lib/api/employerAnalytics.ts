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

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/analytics/employer/${path}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load analytics");
  return (await res.json()).data as T;
}

/* ─── GET /analytics/me (employer role) ─────────────────────────────────── */

/** Mirrors the employer branch of the backend's `getMyAnalytics`. */
export interface EmployerAnalytics {
  role: string;
  counters: {
    jobsCount: number;
    activeJobs: number;
    draftJobs: number;
    pausedJobs: number;
    viewsCount: number;
    applicationsCount: number;
    savedJobsCount: number;
    hiredCount: number;
    applicationsToday: number;
    newActiveJobsThisWeek: number;
  };
  breakdowns: {
    jobsByStatus: Record<string, number>;
    applicationsByStatus: Record<string, number>;
    applicationsByStage: { stage: string; count: number }[];
  };
  conversion: {
    applicationPerViewRatePct: number;
    savePerViewRatePct: number;
    viewsPerApplication: number;
  };
  trends: { applicantsWeekOverWeekPct: number };
  topJobs: {
    id: string;
    title: string;
    status: string;
    viewsCount: number;
    applicationsCount: number;
    createdAt: string;
    publishedAt: string | null;
  }[];
  recentApplications: unknown[];
}

/** Dashboard counters for the signed-in employer. */
export async function getMyAnalytics(): Promise<EmployerAnalytics> {
  const res = await fetch(`${API_BASE_URL}/analytics/me`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load analytics");
  return (await res.json()).data as EmployerAnalytics;
}

/* ─── GET /analytics/employer/* (the analytics page) ────────────────────── */

export interface Kpi {
  id: string;
  label: string;
  /** Null when there's nothing to measure. Render "—", never 0. */
  value: number | null;
  unit?: "count" | "days" | "percent";
  /** % change vs the previous window; null when there's no baseline. */
  delta: number | null;
  definition: string;
}

export interface OverviewResponse {
  range: { start: string; end: string; days: number };
  /** First day with captured events. Charts must not imply history before it. */
  trackingSince: string | null;
  profileCreatedAt: string | null;
  kpis: Kpi[];
  trend: {
    day: string;
    profileViews: number;
    jobViews: number;
    applyClicks: number;
    uniqueVisitors: number;
  }[];
  applicationsTrend: { day: string; count: number }[];
  /** Running follower total per day — cumulative, not daily additions. */
  followersTrend: { day: string; count: number }[];
}

export interface FunnelStage {
  stage: string;
  volume: number;
  /** Null on the first stage — nothing to convert from. */
  conversionFromPrev: number | null;
}

export interface FunnelResponse {
  range: { start: string; end: string; days: number };
  /** From event capture — only exists from when tracking began. */
  reach: FunnelStage[];
  /** From application records — covers all history. */
  pipeline: FunnelStage[];
  notes: { reach: string; applyStarted: string };
}

export interface JobRow {
  id: string;
  title: string;
  department: string | null;
  status: string;
  views: number;
  viewsAllTime: number;
  applications: number;
  interviews: number;
  hires: number;
  conversion: number | null;
}

export interface TalentResponse {
  skills: { skill: string; demand: number; supply: number }[];
  note: string;
}

/**
 * A deterministic insight — a threshold rule over real records.
 * Deliberately has no confidence or impact score: these are counts, not
 * predictions, and a confidence figure on a count is decoration.
 */
export interface Insight {
  id: string;
  kind: "action" | "attention" | "observation";
  title: string;
  body: string;
  /** The numbers the rule fired on, shown so the claim can be checked. */
  evidence: string;
  link: string | null;
  linkLabel: string | null;
  affected: number;
}

export interface SourcesResponse {
  range: { start: string; end: string; days: number };
  totalSessions: number;
  channels: { channel: string; sessions: number; share: number }[];
  campaigns: { campaign: string; sessions: number }[];
  /** Why "Direct" isn't the same as "people who know our name". */
  caveat: string;
  note: string | null;
}

export interface GeoResponse {
  range: { start: string; end: string; days: number };
  /** 'country' = edge-resolved and reliable, 'timezone' = approximate. */
  basis: "country" | "timezone" | null;
  totalSessions: number;
  places: { place: string; sessions: number; share: number }[];
  caveat: string | null;
  note: string | null;
}

/** A post, ranked by engagement. No view count — impressions aren't tracked. */
export interface TopPost {
  id: string;
  excerpt: string;
  postType: string;
  likes: number;
  comments: number;
  bookmarks: number;
  engagement: number;
  createdAt: string;
}

export interface BrandResponse {
  range: { start: string; end: string; days: number };
  kpis: Kpi[];
  topContent: TopPost[];
}

export const getBrand = (days = 30) => get<BrandResponse>(`brand?days=${days}`);

export interface ScoreItem {
  label: string;
  points: number;
  done: boolean;
  /** False when there's nothing to judge yet — excluded from the total. */
  applicable: boolean;
  hint?: string;
  link?: string;
}

export interface BrandScoreResponse {
  /** 0-100 of the APPLICABLE points, or null when nothing applies yet. */
  score: number | null;
  earned: number;
  possible: number;
  components: {
    id: string;
    label: string;
    description: string;
    earned: number;
    possible: number;
    items: ScoreItem[];
  }[];
  nextSteps: string[];
  /** Plain-language description of how the number is produced. */
  method: string;
}

export const getBrandScore = () => get<BrandScoreResponse>("brand-score");

export const getGeo = (days = 30) => get<GeoResponse>(`geo?days=${days}`);

export const getSources = (days = 30) => get<SourcesResponse>(`sources?days=${days}`);

export const getInsights = () =>
  get<{ insights: Insight[]; generatedAt: string }>("insights");

export const getOverview = (days = 30) => get<OverviewResponse>(`overview?days=${days}`);
export const getFunnel = (days = 30, jobId?: string) =>
  get<FunnelResponse>(`funnel?days=${days}${jobId ? `&jobId=${encodeURIComponent(jobId)}` : ""}`);
export const getJobsAnalytics = (days = 30) =>
  get<{ range: unknown; rows: JobRow[] }>(`jobs?days=${days}`);
export const getTalent = () => get<TalentResponse>("talent");

/* ─── GET /analytics/employer/competitors ───────────────────────────────── */

export interface CompetitorCompany {
  name: string;
  logo: string | null;
  /** Public company page id; null for admin-posted jobs with no linked employer. */
  profileId: string | null;
  similarJobs: number;
  /** Which of your live roles their posts resemble. */
  yourRoles: string[];
  latestPostedAt: string;
  examples: {
    jobId: string;
    title: string;
    location: string | null;
    similarTo: string;
    /** "Same role", or "N shared skills" — why it counted. */
    reason: string;
  }[];
}

export interface CompetitorRole {
  jobId: string;
  title: string;
  competingCompanies: number;
  competingJobs: number;
  pay: {
    currency: string;
    period: string | null;
    /** Midpoint of your posted range; null when you didn't post one. */
    yours: number | null;
    /** Similar posts in the same currency and period. */
    samples: number;
    /** Null below three samples — a median of two is an anecdote. */
    median: number | null;
  };
}

export interface CompetitorsResponse {
  summary: { companies: number; jobs: number; rolesCompared: number };
  companies: CompetitorCompany[];
  roles: CompetitorRole[];
  note: string;
}

export const getCompetitors = () => get<CompetitorsResponse>("competitors");

/** Formats a KPI for display. Null is "—" — never a stand-in zero. */
export function formatKpi(k: Kpi): string {
  if (k.value === null) return "—";
  if (k.unit === "days") return `${k.value}d`;
  if (k.unit === "percent") return `${k.value}%`;
  return k.value.toLocaleString();
}
