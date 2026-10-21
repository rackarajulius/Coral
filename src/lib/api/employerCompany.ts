import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

export interface CompanySocialLink {
  id: string;
  label: string;
  url: string;
}

export interface CompanyLocation {
  id: string;
  city: string;
  country: string;
  isHQ?: boolean;
}

export interface CompanyCoreValue {
  title: string;
  description?: string;
  icon?: string;
}

export interface CompanyGalleryPhoto {
  id?: string;
  url: string;
  caption?: string;
}

export interface CompanyAward {
  id?: string;
  title: string;
  organization: string;
  year: string;
  description?: string;
  badgeUrl?: string;
}

export interface CompanyDeiStat {
  id?: string;
  label: string;
  value: string;
}

export interface CompanyWhyCard {
  id?: string;
  icon?: string;
  title: string;
  description?: string;
}

export interface EmployerCompany {
  id: string;
  userId: string;
  companyId: string | null;
  companyName: string;
  companyLogo: string | null;
  companyWebsite: string | null;
  companySize: string | null;
  industry: string | null;
  jobTitle: string;
  department: string | null;
  isHiringManager: boolean;
  isRecruiter: boolean;
  isAdmin: boolean;
  companyDescription: string | null;
  companyBenefits: string[];
  companyCulture: string | null;
  culturePhilosophy: string | null;
  cultureCollaboration: string | null;
  cultureImageUrl: string | null;
  headquarters: string | null;
  companyLocations: string[];
  socialLinks: CompanySocialLink[];
  /** Public contact details — not the recruiter's account email. */
  supportEmail: string | null;
  supportPhone: string | null;
  tagline: string | null;
  companyBanner: string | null;
  foundedYear: number | null;
  industries: string[];
  locations: CompanyLocation[];
  coreValues: CompanyCoreValue[];
  galleryPhotos: CompanyGalleryPhoto[];
  whyWorkHere: CompanyWhyCard[];
  awards: CompanyAward[];
  diversityStatement: string | null;
  deiStats: CompanyDeiStat[];
  cultureVideoUrl: string | null;
  overview: string | null;
  mission: string | null;
  vision: string | null;
  visibility: "public" | "unlisted" | "private";
  showJobs: boolean;
  allowFollow: boolean;
  verificationStatus: "unverified" | "verified";
  openJobs?: number;
  followerCount?: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
  };
}

export type UpdateEmployerCompanyPayload = Partial<
  Omit<
    EmployerCompany,
    "id" | "userId" | "createdAt" | "updatedAt" | "user" | "openJobs" | "verificationStatus"
  >
>;

export interface ListCompaniesParams {
  query?: string;
  page?: number;
  limit?: number;
}

export interface ListCompaniesResponse {
  success: boolean;
  data: EmployerCompany[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
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

/** Like {@link authHeaders}, but omits Content-Type so the browser can set the multipart boundary. */
async function authHeadersForUpload(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({ message: fallback }));
  throw new Error(body.message || fallback);
}

export async function getMyCompany(): Promise<EmployerCompany> {
  const res = await fetch(`${API_BASE_URL}/employers/me/company`, {
    headers: await authHeaders(),
  });

  if (!res.ok) {
    return parseError(res, "Failed to load company profile");
  }

  const json = await res.json();
  return json.data;
}

export async function updateMyCompany(payload: UpdateEmployerCompanyPayload): Promise<EmployerCompany> {
  const res = await fetch(`${API_BASE_URL}/employers/me/company`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return parseError(res, "Failed to update company profile");
  }

  const json = await res.json();
  return json.data;
}

export async function listCompanies(params: ListCompaniesParams = {}): Promise<ListCompaniesResponse> {
  const search = new URLSearchParams();
  if (params.query) search.set("query", params.query);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));

  const qs = search.toString();
  const res = await fetch(`${API_BASE_URL}/employers/companies${qs ? `?${qs}` : ""}`);

  if (!res.ok) {
    return parseError(res, "Failed to load companies");
  }

  return res.json();
}

export async function uploadCompanyLogo(file: File): Promise<EmployerCompany> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/employers/me/company/logo`, {
    method: "POST",
    headers: await authHeadersForUpload(),
    body: formData,
  });

  if (!res.ok) {
    return parseError(res, "Failed to upload logo");
  }

  const json = await res.json();
  return json.data;
}

export async function uploadCompanyBanner(file: File): Promise<EmployerCompany> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/employers/me/company/banner`, {
    method: "POST",
    headers: await authHeadersForUpload(),
    body: formData,
  });

  if (!res.ok) {
    return parseError(res, "Failed to upload banner");
  }

  const json = await res.json();
  return json.data;
}

/**
 * Uploads a gallery image or culture video to storage and returns its public
 * URL. The caller stores the URL on the company record (gallery item or
 * cultureVideoUrl) and persists it via {@link updateMyCompany}.
 */
export async function uploadCompanyMedia(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/employers/me/company/media`, {
    method: "POST",
    headers: await authHeadersForUpload(),
    body: formData,
  });

  if (!res.ok) {
    return parseError(res, "Failed to upload media");
  }

  const json = await res.json();
  return json.data?.url as string;
}

export interface SimilarCompany {
  id: string;
  name: string;
  industry: string;
  description: string;
  cover: string | null;
  logo: string | null;
  openJobs: number;
}

/** Public companies in the same industry as the given one. */
export async function getSimilarCompanies(id: string): Promise<SimilarCompany[]> {
  const res = await fetch(`${API_BASE_URL}/employers/companies/${encodeURIComponent(id)}/similar`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data ?? []) as SimilarCompany[];
}

/**
 * What applying to a company is actually like — measured from the pipeline,
 * not claimed by the employer.
 */
export interface HiringStats {
  /** False when there is too little to say anything; the section renders nothing. */
  available: boolean;
  /** Applications behind the figures. Always shown beside them. */
  sampleSize: number;
  windowDays: number;
  /** Share that got any answer at all, 0-100. */
  responseRate: number | null;
  /** Share still waiting with no word after 30 days, 0-100. */
  ghostedRate: number | null;
  /** Median days from applying to the first reply. */
  medianDaysToFirstResponse: number | null;
  /** How many first responses that median is drawn from. */
  measuredResponses: number;
  /** The stages candidates actually reach here, commonest first. */
  stages: Array<{ stage: string; count: number }>;
}

/** Public: a company's real responsiveness. Absent figures come back as nulls. */
export async function getCompanyHiringStats(id: string): Promise<HiringStats | null> {
  const res = await fetch(
    `${API_BASE_URL}/employers/companies/${encodeURIComponent(id)}/hiring-stats`,
  );
  if (!res.ok) return null;
  const json = await res.json();
  return (json.data ?? null) as HiringStats | null;
}

/** The same figures for the signed-in employer's own company. */
export async function getMyHiringStats(): Promise<HiringStats | null> {
  const res = await fetch(`${API_BASE_URL}/employers/me/hiring-stats`, {
    headers: await authHeaders(),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return (json.data ?? null) as HiringStats | null;
}

/**
 * Hiring commitments, checked: what a company's live postings state, and
 * whether interviewed candidates hear back within 45 days. Read from postings
 * and interviews, so the company can't edit them.
 */
export interface HiringCommitments {
  postings: {
    /** Live postings the facts are drawn from. */
    open: number;
    withPay: number;
    vacancyStated: number;
    /** Of those, gathering candidates for future openings rather than open now. */
    futureOpenings: number;
    usingAi: number;
  };
  afterInterview: {
    /** False below the sample threshold; the figures are then null. */
    available: boolean;
    /** Interviews judged: answered, or past the deadline without an answer. */
    measured: number;
    deadlineDays: number;
    /** Share told where they stand within the deadline, 0-100. */
    withinDeadlineRate: number | null;
    medianDaysToOutcome: number | null;
  };
}

export interface JobRef {
  id: string;
  title: string;
}

/** The employer's own view adds what they can fix. */
export interface MyHiringCommitments extends HiringCommitments {
  toFix: {
    missingPay: JobRef[];
    payRangeTooWide: JobRef[];
    vacancyUnstated: JobRef[];
    canadianExperience: JobRef[];
    outcomesDueSoon: number;
    outcomesOverdue: number;
  };
}

/** Public: a company's checked hiring commitments. */
export async function getCompanyHiringCommitments(id: string): Promise<HiringCommitments | null> {
  const res = await fetch(
    `${API_BASE_URL}/employers/companies/${encodeURIComponent(id)}/hiring-commitments`,
  );
  if (!res.ok) return null;
  const json = await res.json();
  return (json.data ?? null) as HiringCommitments | null;
}

/** The signed-in employer's own, with what to fix. */
export async function getMyHiringCommitments(): Promise<MyHiringCommitments | null> {
  const res = await fetch(`${API_BASE_URL}/employers/me/hiring-commitments`, {
    headers: await authHeaders(),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return (json.data ?? null) as MyHiringCommitments | null;
}

export interface FollowStatus {
  isFollowing: boolean;
  followerCount: number;
}

/** Current user's follow state for a company (requires auth). */
export async function getFollowStatus(id: string): Promise<FollowStatus> {
  const res = await fetch(`${API_BASE_URL}/employers/companies/${encodeURIComponent(id)}/follow`, {
    headers: await authHeaders(),
  });
  if (!res.ok) return parseError(res, "Failed to load follow status");
  const json = await res.json();
  return json.data as FollowStatus;
}

/** Follow (method POST) or unfollow (method DELETE) a company. Returns the new state. */
export async function setFollowCompany(id: string, follow: boolean): Promise<FollowStatus> {
  const res = await fetch(`${API_BASE_URL}/employers/companies/${encodeURIComponent(id)}/follow`, {
    method: follow ? "POST" : "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) return parseError(res, follow ? "Failed to follow company" : "Failed to unfollow company");
  const json = await res.json();
  return json.data as FollowStatus;
}

export async function getCompanyById(id: string): Promise<EmployerCompany> {
  const res = await fetch(`${API_BASE_URL}/employers/companies/${encodeURIComponent(id)}`);

  if (!res.ok) {
    return parseError(res, res.status === 404 ? "Company not found" : "Failed to load company");
  }

  const json = await res.json();
  return json.data;
}
