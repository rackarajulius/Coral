import supabase from "@/lib/supabase";
import { splitLocation, type LocationParts } from "@/lib/location/places";

/** Re-exported where they always were; they live with the other place helpers. */
export { splitLocation, type LocationParts };

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

/* -------------------------------------------------------------------------- */
/*  Backend response types (mirror of Prisma JobSeekerProfile + relations)    */
/* -------------------------------------------------------------------------- */

export interface ServerExperience {
  id: string;
  title: string;
  company: string;
  companyLogo: string | null;
  location: string | null;
  employmentType: string | null;
  startDate: string;
  endDate: string | null;
  current: boolean;
  verified: boolean;
  verifiedWorkDomain?: string | null;
  description: string | null;
}

export interface ServerEducation {
  id: string;
  institution: string;
  institutionLogo: string | null;
  degree: string;
  fieldOfStudy: string | null;
  location: string | null;
  gpa: string | null;
  honors: string | null;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string | null;
}

export interface ServerCertification {
  id: string;
  name: string;
  issuingOrg: string;
  issuingOrgLogo: string | null;
  credentialId: string | null;
  credentialUrl: string | null;
  issueDate: string;
  expirationDate: string | null;
  noExpiration: boolean;
}

export interface ServerPortfolioItem {
  id: string;
  title: string;
  mediaType: string | null;
  description: string | null;
  projectUrl: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
}

export interface ServerRecommendation {
  id: string;
  author: string;
  authorTitle: string | null;
  relationship: string | null;
  text: string;
  date: string | null;
}

export interface NotificationSettings {
  emailJobAlerts: boolean;
  emailApplicationUpdates: boolean;
  emailMarketing: boolean;
  pushJobAlerts: boolean;
  pushApplicationUpdates: boolean;
  pushMessages: boolean;
  /** In-app digest of jobs Coral picked for you. */
  pushJobRecommendations: boolean;
  /** Email digest of picked jobs. Opt-in (CASL): off until turned on. */
  emailJobRecommendations: boolean;
}

export interface PrivacySettings {
  profileVisible: boolean;
  showEmail: boolean;
  showPhone: boolean;
  allowMessages: boolean;
  showSalaryExpectations: boolean;
}

export const defaultNotificationSettings = (): NotificationSettings => ({
  emailJobAlerts: true,
  emailApplicationUpdates: true,
  emailMarketing: false,
  pushJobAlerts: true,
  pushApplicationUpdates: true,
  pushMessages: true,
  // Must match backend/src/notifications/seeker-preferences.ts.
  pushJobRecommendations: true,
  emailJobRecommendations: false,
});

export const defaultPrivacySettings = (): PrivacySettings => ({
  profileVisible: true,
  showEmail: false,
  showPhone: false,
  allowMessages: true,
  showSalaryExpectations: false,
});

export interface ServerJobSeekerProfile {
  id: string;
  userId: string;
  headline: string | null;
  summary: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  remotePreference: string | null;
  jobTypes: string[];
  experienceLevel: string | null;
  salaryExpectation: string | null;
  availableFrom: string | null;
  skills: string[];
  languages: string[];
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  twitterUrl: string | null;
  resumeUrl: string | null;
  // Availability & contact (profile sync completion migration)
  openToWork: boolean;
  discoverable: boolean;
  contactEmail: string | null;
  phone: string | null;
  notificationSettings: NotificationSettings | null;
  privacySettings: PrivacySettings | null;
  workEligibility: string | null;
  workPermitExpiry: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  introVideoUrl: string | null;
  // Extended job preferences
  preferredLocations: string[];
  preferredIndustries: string[];
  keywords: string[];
  willingToRelocate: boolean;
  remoteWork: boolean;
  experiences?: ServerExperience[];
  educations?: ServerEducation[];
  certifications?: ServerCertification[];
  portfolioItems?: ServerPortfolioItem[];
  recommendations?: ServerRecommendation[];
}

/**
 * Profile-level fields the page keeps in sync via the single PATCH endpoint.
 * (List entities — experiences, educations, etc. — sync via their own CRUD.)
 */
export interface UpdateJobSeekerProfilePayload {
  headline?: string;
  city?: string;
  state?: string;
  country?: string;
  summary?: string;
  languages?: string[];
  skills?: string[];
  // Availability & contact
  openToWork?: boolean;
  discoverable?: boolean;
  contactEmail?: string;
  phone?: string;
  notificationSettings?: NotificationSettings;
  privacySettings?: PrivacySettings;
  workEligibility?: string;
  workPermitExpiry?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  twitterUrl?: string;
  // Job preferences
  jobTypes?: string[];
  experienceLevel?: string;
  salaryExpectation?: string;
  preferredLocations?: string[];
  preferredIndustries?: string[];
  keywords?: string[];
  willingToRelocate?: boolean;
  remoteWork?: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Auth + fetch helpers                                                      */
/* -------------------------------------------------------------------------- */

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

/** Returns true when the visitor has a Supabase session (i.e. is signed in). */
export async function hasSession(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return !!session?.access_token;
}

/** Auth header without Content-Type, so the browser sets the multipart boundary. */
async function authHeaderOnly(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({ message: fallback }));
  throw new Error(body.message || fallback);
}

/**
 * Tells the server this seeker's browser timezone, once per session.
 *
 * Used only to suggest when a recruiter's message would land in their working
 * hours. Fire-and-forget: nothing the seeker is doing waits on it, and a
 * failure just means no suggestion until next time.
 */
export function reportTimezone(userId: string): void {
  let zone = "";
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return;
  }
  if (!zone) return;
  const key = `coral:tz-reported:${userId}`;
  try {
    if (sessionStorage.getItem(key) === zone) return;
  } catch {
    /* private mode: report anyway */
  }
  void (async () => {
    const res = await fetch(`${API_BASE_URL}/job-seekers/me/timezone`, {
      method: "PUT",
      headers: { ...(await authHeaderOnly()), "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: zone }),
    });
    if (res.ok) {
      try {
        sessionStorage.setItem(key, zone);
      } catch {
        /* nothing to remember it in */
      }
    }
  })().catch(() => undefined);
}

/** Uploads a profile photo (avatar); returns its public URL. */
export async function uploadAvatar(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/avatar`, {
    method: "POST",
    headers: await authHeaderOnly(),
    body: form,
  });
  if (!res.ok) await parseError(res, "Failed to upload photo");
  const json = await res.json();
  return json.data?.avatarUrl as string;
}

/** Removes the profile photo (clears the column and deletes the stored file). */
export async function deleteAvatar(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/avatar`, {
    method: "DELETE",
    headers: await authHeaderOnly(),
  });
  if (!res.ok) await parseError(res, "Failed to remove photo");
}

/** Uploads a banner image; returns its public URL. */
export async function uploadBanner(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/banner`, {
    method: "POST",
    headers: await authHeaderOnly(),
    body: form,
  });
  if (!res.ok) await parseError(res, "Failed to upload banner");
  const json = await res.json();
  return json.data?.bannerUrl as string;
}

/**
 * Uploads a Featured item's image; returns its public URL.
 *
 * The image belongs in storage, not in the item: it used to be base64-encoded
 * into the item itself, which both bloated every profile response and failed
 * above ~1.5 MB.
 */
export async function uploadPortfolioImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/portfolio/image`, {
    method: "POST",
    headers: await authHeaderOnly(),
    body: form,
  });
  if (!res.ok) await parseError(res, "Failed to upload image");
  const json = await res.json();
  return json.data?.imageUrl as string;
}

export interface ParsedResume {
  name: string;
  headline: string;
  summary: string;
  skills: string[];
  languages: string[];
  experiences: { title: string; company: string; location: string; period: string; description: string }[];
  educations: { degree: string; school: string; location: string; period: string; description: string }[];
}

/**
 * Generates 3 AI-improved professional headline options from the signed-in
 * user's profile. `targetRole` optionally tailors the suggestions.
 */
export async function suggestHeadlines(targetRole?: string): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/headline/suggestions`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ targetRole }),
  });
  if (!res.ok) await parseError(res, "Failed to generate headlines");
  const json = await res.json();
  return (json.data?.suggestions ?? []) as string[];
}

export interface RoleReadiness {
  score: number;
  verdict: string;
  strengths: string[];
  gaps: string[];
  missingSkills: string[];
  suggestedActions: string[];
}

/** Assesses how ready the signed-in user's profile is for a given target role. */
export async function analyzeRoleReadiness(targetRole: string): Promise<RoleReadiness> {
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/readiness/analyze`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ targetRole }),
  });
  if (!res.ok) await parseError(res, "Failed to analyze readiness");
  const json = await res.json();
  return json.data as RoleReadiness;
}

/** Uploads a resume (PDF/DOCX/TXT) and returns AI-extracted structured data. Stateless — no file is stored. */
export async function parseResume(file: File): Promise<ParsedResume> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/resume/parse`, {
    method: "POST",
    headers: await authHeaderOnly(),
    body: form,
  });
  if (!res.ok) await parseError(res, "Failed to parse resume");
  const json = await res.json();
  return json.data as ParsedResume;
}

/** Removes the banner image (clears the column and deletes the stored file). */
export async function deleteBanner(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/banner`, {
    method: "DELETE",
    headers: await authHeaderOnly(),
  });
  if (!res.ok) await parseError(res, "Failed to remove banner");
}

/** Uploads an introduction video; returns its public URL. */
export async function uploadIntroVideo(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/intro-video`, {
    method: "POST",
    headers: await authHeaderOnly(),
    body: form,
  });
  if (!res.ok) await parseError(res, "Failed to upload video");
  const json = await res.json();
  return json.data?.introVideoUrl as string;
}

/* -------------------------------------------------------------------------- */
/*  Endpoints                                                                 */
/* -------------------------------------------------------------------------- */

/** GET /job-seekers/me/profile — auto-creates an empty profile on first call. */
export async function getMyProfile(): Promise<ServerJobSeekerProfile> {
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/profile`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await parseError(res, "Failed to load profile");
  const json = await res.json();
  return json.data as ServerJobSeekerProfile;
}

/** PATCH /job-seekers/me/profile — replaces the supplied fields. */
export async function updateMyProfile(
  payload: UpdateJobSeekerProfilePayload,
): Promise<ServerJobSeekerProfile> {
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/profile`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseError(res, "Failed to save profile");
  const json = await res.json();
  return json.data as ServerJobSeekerProfile;
}

/* -------------------------------------------------------------------------- */
/*  Mappers between the backend profile and the ProfileContext shape          */
/* -------------------------------------------------------------------------- */

/** Contact links in the ProfileContext shape (all strings; "" when unset). */
export interface SyncedContactLinks {
  email: string;
  website: string;
  linkedin: string;
  github: string;
  twitter: string;
}

/** Job preferences in the ProfileContext shape. */
export interface SyncedJobPreferences {
  jobTypes: string[];
  experienceLevel: string;
  expectedSalary: string;
  locations: string[];
  willingToRelocate: boolean;
  remoteWork: boolean;
  industries: string[];
  keywords: string[];
}

/** The subset of ProfileData this module keeps in sync with the backend. */
export interface SyncedProfileFields {
  about: string;
  headline: string;
  /** "City, State, Country" — the one line the profile shows. */
  location: string;
  /** The columns that line was built from, for an edit-free round trip. */
  locationParts: LocationParts;
  languages: string[];
  skillNames: string[];
  openToWork: boolean;
  discoverable: boolean;
  workEligibility: string;
  workPermitExpiry: string;
  avatarUrl: string;
  bannerUrl: string;
  introVideoUrl: string;
  phone: string;
  notificationSettings: NotificationSettings;
  privacySettings: PrivacySettings;
  contactLinks: SyncedContactLinks;
  jobPreferences: SyncedJobPreferences;
}

/** Backend profile → the ProfileContext fields we hydrate. */
export function mapServerProfileToSyncedFields(
  server: ServerJobSeekerProfile,
): SyncedProfileFields {
  return {
    about: server.summary ?? "",
    headline: server.headline ?? "",
    location: [server.city, server.state, server.country]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", "),
    locationParts: {
      city: server.city ?? "",
      state: server.state ?? "",
      country: server.country ?? "",
    },
    languages: Array.isArray(server.languages) ? server.languages : [],
    skillNames: Array.isArray(server.skills) ? server.skills : [],
    openToWork: !!server.openToWork,
    // Defaults to true, matching the column: a profile saved before this
    // existed is discoverable, and reading it as false would quietly opt
    // everyone out on their next save.
    discoverable: server.discoverable !== false,
    workEligibility: server.workEligibility ?? "",
    workPermitExpiry: server.workPermitExpiry ?? "",
    avatarUrl: server.avatarUrl ?? "",
    bannerUrl: server.bannerUrl ?? "",
    introVideoUrl: server.introVideoUrl ?? "",
    phone: server.phone ?? "",
    notificationSettings: { ...defaultNotificationSettings(), ...(server.notificationSettings ?? {}) },
    privacySettings: { ...defaultPrivacySettings(), ...(server.privacySettings ?? {}) },
    contactLinks: {
      email: server.contactEmail ?? "",
      website: server.portfolioUrl ?? "",
      linkedin: server.linkedinUrl ?? "",
      github: server.githubUrl ?? "",
      twitter: server.twitterUrl ?? "",
    },
    jobPreferences: {
      jobTypes: Array.isArray(server.jobTypes) ? server.jobTypes : [],
      experienceLevel: server.experienceLevel ?? "",
      expectedSalary: server.salaryExpectation ?? "",
      locations: Array.isArray(server.preferredLocations) ? server.preferredLocations : [],
      willingToRelocate: !!server.willingToRelocate,
      remoteWork: !!server.remoteWork,
      industries: Array.isArray(server.preferredIndustries) ? server.preferredIndustries : [],
      keywords: Array.isArray(server.keywords) ? server.keywords : [],
    },
  };
}

/** ProfileContext fields → the PATCH payload. */
export function buildProfileSyncPayload(fields: {
  about: string;
  headline: string;
  /** The typed line, or the loaded columns when the line was not edited. */
  location: string | LocationParts;
  languages: string[];
  skills: { name: string }[];
  openToWork: boolean;
  discoverable: boolean;
  workEligibility: string;
  workPermitExpiry: string;
  phone: string;
  notificationSettings: NotificationSettings;
  privacySettings: PrivacySettings;
  contactLinks: Partial<SyncedContactLinks>;
  jobPreferences: SyncedJobPreferences;
}): UpdateJobSeekerProfilePayload {
  const { contactLinks, jobPreferences } = fields;
  return {
    summary: fields.about ?? "",
    headline: fields.headline ?? "",
    ...(typeof fields.location === "string"
      ? splitLocation(fields.location)
      : fields.location),
    languages: fields.languages ?? [],
    skills: (fields.skills ?? []).map((s) => s.name),
    openToWork: fields.openToWork,
    discoverable: fields.discoverable,
    phone: fields.phone ?? "",
    notificationSettings: fields.notificationSettings,
    privacySettings: fields.privacySettings,
    workEligibility: fields.workEligibility ?? "",
    workPermitExpiry: fields.workPermitExpiry ?? "",
    contactEmail: contactLinks.email ?? "",
    portfolioUrl: contactLinks.website ?? "",
    linkedinUrl: contactLinks.linkedin ?? "",
    githubUrl: contactLinks.github ?? "",
    twitterUrl: contactLinks.twitter ?? "",
    jobTypes: jobPreferences.jobTypes ?? [],
    experienceLevel: jobPreferences.experienceLevel ?? "",
    salaryExpectation: jobPreferences.expectedSalary ?? "",
    preferredLocations: jobPreferences.locations ?? [],
    preferredIndustries: jobPreferences.industries ?? [],
    keywords: jobPreferences.keywords ?? [],
    willingToRelocate: !!jobPreferences.willingToRelocate,
    remoteWork: !!jobPreferences.remoteWork,
  };
}

/* -------------------------------------------------------------------------- */
/*  List-entity CRUD (each list item has its own endpoint)                    */
/* -------------------------------------------------------------------------- */

async function apiSend<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: await authHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) await parseError(res, `Request failed (${res.status})`);
  const json = await res.json().catch(() => ({}));
  return (json as { data?: T }).data as T;
}

/* ---- Portfolio ---- */

export interface PortfolioItemDtoPayload {
  title: string;
  mediaType?: string;
  description?: string;
  projectUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
}

export const apiCreatePortfolioItem = (dto: PortfolioItemDtoPayload) =>
  apiSend<ServerPortfolioItem>("POST", "/job-seekers/me/portfolio", dto);
export const apiUpdatePortfolioItem = (id: string, dto: Partial<PortfolioItemDtoPayload>) =>
  apiSend<ServerPortfolioItem>("PATCH", `/job-seekers/me/portfolio/${id}`, dto);
export const apiDeletePortfolioItem = (id: string) =>
  apiSend<void>("DELETE", `/job-seekers/me/portfolio/${id}`);

/** Frontend portfolio item → backend payload. */
export function portfolioItemToDto(item: {
  type?: string;
  title: string;
  description?: string;
  link?: string;
  imageUrl?: string;
}): PortfolioItemDtoPayload {
  return {
    title: item.title,
    mediaType: item.type || undefined,
    description: item.description || undefined,
    projectUrl: item.link || undefined,
    imageUrl: item.imageUrl || undefined,
  };
}

/* ---- Recommendations ---- */

export interface RecommendationDtoPayload {
  author: string;
  authorTitle?: string;
  relationship?: string;
  text: string;
  date?: string;
}

export const apiCreateRecommendation = (dto: RecommendationDtoPayload) =>
  apiSend<ServerRecommendation>("POST", "/job-seekers/me/recommendations", dto);
export const apiUpdateRecommendation = (id: string, dto: Partial<RecommendationDtoPayload>) =>
  apiSend<ServerRecommendation>("PATCH", `/job-seekers/me/recommendations/${id}`, dto);
export const apiDeleteRecommendation = (id: string) =>
  apiSend<void>("DELETE", `/job-seekers/me/recommendations/${id}`);

/** Frontend recommendation → backend payload. */
export function recommendationToDto(rec: {
  author: string;
  authorTitle?: string;
  relationship?: string;
  text: string;
  date?: string;
}): RecommendationDtoPayload {
  return {
    author: rec.author,
    authorTitle: rec.authorTitle || undefined,
    relationship: rec.relationship || undefined,
    text: rec.text,
    date: rec.date || undefined,
  };
}

/* -------------------------------------------------------------------------- */
/*  Date helpers (free-text "period" ↔ backend ISO dates)                     */
/* -------------------------------------------------------------------------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Jan 2022" / "2022" / "2022-06" → ISO string, or null if unparseable. */
export function looseDateToIso(input: string): string | null {
  const s = (input || '').trim();
  if (!s) return null;
  const monthYear = s.match(/^([A-Za-z]{3,})\.?\s+(\d{4})$/);
  if (monthYear) {
    const idx = MONTHS.findIndex((m) => monthYear[1].toLowerCase().startsWith(m.toLowerCase()));
    if (idx >= 0) return new Date(Date.UTC(Number(monthYear[2]), idx, 1)).toISOString();
  }
  const ym = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (ym) return new Date(Date.UTC(Number(ym[1]), Number(ym[2]) - 1, 1)).toISOString();
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return new Date(Date.UTC(Number(yearOnly[1]), 0, 1)).toISOString();
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Period string ("Jan 2022 - Present", "2015 - 2019") → backend date fields. */
export function parsePeriod(period: string): {
  startDate: string | null;
  endDate: string | null;
  current: boolean;
} {
  const parts = (period || '').split(/[-–—]/);
  const startStr = (parts[0] || '').trim();
  const endStr = (parts[1] || '').trim();
  const current = /present|current|now|ongoing/i.test(endStr) || (parts.length >= 2 && endStr === '');
  return {
    startDate: looseDateToIso(startStr),
    endDate: current ? null : looseDateToIso(endStr),
    current,
  };
}

/** ISO start/end → display "Mon YYYY - Mon YYYY" / "... - Present". */
export function formatPeriod(
  startDate: string | null,
  endDate: string | null,
  current: boolean,
): string {
  const fmt = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  const start = fmt(startDate);
  if (!start) return '';
  const end = current ? 'Present' : fmt(endDate) || 'Present';
  return `${start} - ${end}`;
}

/** Rough duration label from ISO dates, e.g. "3 yrs 2 mos". */
export function formatDuration(
  startDate: string | null,
  endDate: string | null,
  current: boolean,
): string {
  if (!startDate) return '';
  const start = new Date(startDate);
  const end = current || !endDate ? new Date() : new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  if (months < 0) months = 0;
  const yrs = Math.floor(months / 12);
  const mos = months % 12;
  const parts: string[] = [];
  if (yrs) parts.push(`${yrs} yr${yrs > 1 ? 's' : ''}`);
  if (mos) parts.push(`${mos} mo${mos > 1 ? 's' : ''}`);
  return parts.join(' ') || '1 mo';
}

/** ISO → "YYYY-MM" (certification issue/expiry display). */
export function isoToYearMonth(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/* ---- Experiences ---- */

export interface ExperienceDtoPayload {
  title: string;
  company: string;
  companyLogo?: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

export const apiCreateExperience = (dto: ExperienceDtoPayload) =>
  apiSend<ServerExperience>('POST', '/job-seekers/me/experiences', dto);
export const apiUpdateExperience = (id: string, dto: Partial<ExperienceDtoPayload>) =>
  apiSend<ServerExperience>('PATCH', `/job-seekers/me/experiences/${id}`, dto);
export const apiDeleteExperience = (id: string) =>
  apiSend<void>('DELETE', `/job-seekers/me/experiences/${id}`);

/** Frontend experience → backend payload. Null if the period has no parseable start date. */
/**
 * Note the absence of `verified`. It used to be sent on every save, which both
 * let the client award itself the badge and clobbered a server-set flag from a
 * stale copy. The server now rejects the field outright.
 */
export function experienceToDto(exp: {
  title: string;
  company: string;
  location?: string;
  period: string;
  description?: string;
}): ExperienceDtoPayload | null {
  const { startDate, endDate, current } = parsePeriod(exp.period);
  if (!startDate) return null;
  return {
    title: exp.title,
    company: exp.company,
    location: exp.location || undefined,
    startDate,
    endDate: endDate || undefined,
    current,
    description: exp.description || undefined,
  };
}

/* ---- Educations ---- */

export interface EducationDtoPayload {
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  location?: string;
  gpa?: string;
  honors?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

export const apiCreateEducation = (dto: EducationDtoPayload) =>
  apiSend<ServerEducation>('POST', '/job-seekers/me/educations', dto);
export const apiUpdateEducation = (id: string, dto: Partial<EducationDtoPayload>) =>
  apiSend<ServerEducation>('PATCH', `/job-seekers/me/educations/${id}`, dto);
export const apiDeleteEducation = (id: string) =>
  apiSend<void>('DELETE', `/job-seekers/me/educations/${id}`);

/** Frontend education → backend payload. Null if the period has no parseable start date. */
export function educationToDto(edu: {
  degree: string;
  school: string;
  location?: string;
  period: string;
  description?: string;
  gpa?: string;
  honors?: string;
}): EducationDtoPayload | null {
  const { startDate, endDate, current } = parsePeriod(edu.period);
  if (!startDate) return null;
  return {
    institution: edu.school,
    degree: edu.degree,
    location: edu.location || undefined,
    gpa: edu.gpa || undefined,
    honors: edu.honors || undefined,
    startDate,
    endDate: endDate || undefined,
    current,
    description: edu.description || undefined,
  };
}

/* ---- Certifications ---- */

export interface CertificationDtoPayload {
  name: string;
  issuingOrg: string;
  credentialId?: string;
  credentialUrl?: string;
  issueDate: string;
  expirationDate?: string;
  noExpiration?: boolean;
}

export const apiCreateCertification = (dto: CertificationDtoPayload) =>
  apiSend<ServerCertification>('POST', '/job-seekers/me/certifications', dto);
export const apiUpdateCertification = (id: string, dto: Partial<CertificationDtoPayload>) =>
  apiSend<ServerCertification>('PATCH', `/job-seekers/me/certifications/${id}`, dto);
export const apiDeleteCertification = (id: string) =>
  apiSend<void>('DELETE', `/job-seekers/me/certifications/${id}`);

/** Frontend certification → backend payload. Null if the issue date is unparseable. */
export function certificationToDto(cert: {
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  noExpiry?: boolean;
}): CertificationDtoPayload | null {
  const issueIso = looseDateToIso(cert.issueDate);
  if (!issueIso) return null;
  return {
    name: cert.name,
    issuingOrg: cert.issuer,
    credentialId: cert.credentialId || undefined,
    credentialUrl: cert.credentialUrl || undefined,
    issueDate: issueIso,
    expirationDate: cert.noExpiry ? undefined : looseDateToIso(cert.expiryDate || '') || undefined,
    noExpiration: !!cert.noExpiry,
  };
}

/* -------------------------------------------------------------------------- */
/*  Profile impressions (views + search appearances)                          */
/* -------------------------------------------------------------------------- */

export interface ProfileStats {
  views: number;
  searchAppearances: number;
  windowDays: number;
  /**
   * Nothing before this date was counted. The UI must say so rather than
   * implying a 90-day history that does not exist yet.
   */
  since: string;
}

/** GET /job-seekers/me/profile-stats — your own numbers only. */
export async function getProfileStats(): Promise<ProfileStats> {
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/profile-stats`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await parseError(res, "Failed to load profile stats");
  const json = await res.json();
  return json.data as ProfileStats;
}

/** How you appear to someone whose profile you viewed. */
export type ViewVisibility = "named" | "company" | "private";

export interface ProfileViewer {
  kind: "named" | "company";
  name: string;
  subtitle: string | null;
  avatarUrl: string | null;
  companyId: string | null;
  lastViewedAt: string;
  views: number;
}

export interface ProfileViewers {
  /** True when you browse privately — the same switch works both ways. */
  locked: boolean;
  reason: string | null;
  viewers: ProfileViewer[];
  /** People who looked in private: a number is all that can honestly be said. */
  privateCount: number;
}

export async function getProfileViewers(): Promise<ProfileViewers> {
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/profile-viewers`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await parseError(res, "Failed to load profile viewers");
  return (await res.json()).data as ProfileViewers;
}

export async function getViewVisibility(): Promise<{ visibility: ViewVisibility; roleDefault: ViewVisibility }> {
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/view-visibility`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await parseError(res, "Failed to load your browsing visibility");
  return (await res.json()).data;
}

/** Applies to future views only; past ones keep the choice made at the time. */
export async function setViewVisibility(visibility: ViewVisibility): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/view-visibility`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ visibility }),
  });
  if (!res.ok) await parseError(res, "Failed to save your browsing visibility");
}

/* -------------------------------------------------------------------------- */
/*  The stored resume                                                         */
/* -------------------------------------------------------------------------- */

/** The file itself: metadata plus a short-lived signed download URL. */
export interface StoredResumeFile {
  fileName: string | null;
  uploadedAt: string | null;
  url: string | null;
}

/** What was read out of it, kept so flows can reuse it without the file. */
export interface StoredResumeSummary {
  fileName: string;
  skills: string[];
  roles: string[];
  experienceYears: number;
  parsedAt: string;
}

export async function getMyResumeFile(): Promise<StoredResumeFile | null> {
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/resume`, {
    headers: await authHeaders(),
  });
  if (!res.ok) return null;
  return ((await res.json())?.data ?? null) as StoredResumeFile | null;
}

/** Removes the file and the summary read from it. */
export async function deleteMyResumeFile(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/resume`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) await parseError(res, "Failed to remove your resume");
}

/** Null when nothing has ever been parsed — never a fabricated empty summary. */
export async function getStoredResumeSummary(): Promise<StoredResumeSummary | null> {
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/profile`, {
    headers: await authHeaders(),
  });
  if (!res.ok) return null;
  const parsed = (await res.json())?.data?.parsedResume as StoredResumeSummary | null | undefined;
  return parsed?.skills?.length || parsed?.roles?.length ? parsed : null;
}
