import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

/** Matches the hiring copilot's Candidate shape (+ id). Contact PII is withheld. */
export interface HiringCandidate {
  id: string;
  name: string;
  role: string;
  company: string;
  location: string;
  match: number;
  reason: string;
  initials: string;
  skills: string[];
  yearsExp: number;
  education: string;
  connection: "1st" | "2nd" | "3rd+";
  openToWork: boolean;
  lastActive: string;
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

/**
 * Everything the server can narrow a candidate search by.
 *
 * `query` is boolean-aware — quoted phrases, `OR`, and `-term`/`NOT term` to
 * exclude. The rest are explicit filters, and every named skill must be
 * present rather than any of them.
 */
export interface SourceCriteria {
  query?: string;
  location?: string;
  skills?: string[];
  seniority?: string;
  industry?: string;
  minYears?: number;
  maxYears?: number;
  remoteOnly?: boolean;
  openToWorkOnly?: boolean;
}

/** Drops the empty ones, so a blank field never reaches the server as a filter. */
function definedCriteria(c: SourceCriteria): SourceCriteria {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as SourceCriteria;
}

/**
 * How many people match, not how many came back. `exact` is false only when a
 * years filter met a pool too big to read in full; `total` is then a floor.
 */
export interface TalentPool {
  total: number;
  exact: boolean;
}

export interface SourcedResult {
  /** The top matches, AI-ranked — a handful, never the whole pool. */
  candidates: HiringCandidate[];
  /** Null when the server predates pool counts. */
  pool: TalentPool | null;
}

/** Sources + AI-ranks real candidates from the talent pool for a role. */
export async function sourceCandidates(criteria: SourceCriteria = {}): Promise<SourcedResult> {
  const res = await fetch(`${API_BASE_URL}/employers/hiring/candidates`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(definedCriteria(criteria)),
  });
  if (!res.ok) throw new Error("Failed to source candidates");
  const json = await res.json();
  return {
    candidates: (json.data?.candidates ?? []) as HiringCandidate[],
    pool: (json.data?.pool ?? null) as TalentPool | null,
  };
}

/** "348", or "5,000+" when the count is a floor. */
export function formatPool(pool: TalentPool): string {
  return `${pool.total.toLocaleString()}${pool.exact ? "" : "+"}`;
}

export interface OutreachDraft {
  subject: string;
  message: string;
}

export interface RoleQualification {
  text: string;
  confidence: number;
}

/** AI-derived role profile: parsed intent + qualifications + job description. */
export interface RoleProfile {
  roleTitle: string;
  roleType: string;
  seniority: string;
  keywords: string[];
  location: string | null;
  remote: boolean;
  required: RoleQualification[];
  niceToHave: RoleQualification[];
  jobDescription: {
    aboutRole: string;
    responsibilities: string[];
    requirements: string[];
    niceToHave: string[];
    /** "" unless the employer's own prompt stated it — never AI-invented. */
    compensation: string;
    /** [] unless the employer's own prompt stated them — never AI-invented. */
    benefits: string[];
  };
}

/** Parses a free-text hiring prompt into a structured, AI-generated role profile. */
export async function getRoleProfile(prompt: string): Promise<RoleProfile> {
  const res = await fetch(`${API_BASE_URL}/employers/hiring/role-profile`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error("Couldn't build the role profile");
  return (await res.json()).data as RoleProfile;
}

export type CopilotAction =
  | { kind: "source"; query: string }
  | { kind: "screen"; candidateId: string; candidateName: string; mode: "text" | "video" }
  | { kind: "outreach"; candidateId: string; candidateName: string }
  | { kind: "none" };

export interface CopilotResult {
  reply: string;
  action: CopilotAction;
}

/** Hiring copilot: NL chat message → grounded reply + resolved next action. */
export async function copilotRespond(input: {
  message: string;
  role?: string;
  candidates: { id?: string; name: string; skills?: string[]; match?: number | null }[];
}): Promise<CopilotResult> {
  const res = await fetch(`${API_BASE_URL}/employers/hiring/copilot`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "The copilot couldn't respond");
  }
  return (await res.json()).data as CopilotResult;
}

/** AI-drafts an editable outreach message for a candidate. */
export async function draftOutreach(candidateId: string, role?: string, tone?: string): Promise<OutreachDraft> {
  const res = await fetch(`${API_BASE_URL}/employers/hiring/outreach/draft`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ candidateId, role, tone }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Failed to draft outreach");
  }
  return (await res.json()).data as OutreachDraft;
}

export interface TemplateOutreach {
  templateId: string;
  subject: string;
  message: string;
  /** `{{…}}` placeholders still to replace — sending is refused until they're gone. */
  unfilled: string[];
}

/** One of the company's saved templates, filled in for this candidate. No AI call. */
export async function outreachFromTemplate(input: {
  templateId: string;
  candidateId: string;
  /** Fills `{{job_title}}`; a sourced candidate has no job, so the project's role. */
  jobTitle?: string;
}): Promise<TemplateOutreach> {
  const res = await fetch(`${API_BASE_URL}/employers/hiring/outreach/from-template`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Couldn't load that template");
  }
  return (await res.json()).data as TemplateOutreach;
}

export type InterviewOutcome = "advancing" | "rejected" | "hold" | "hired";

export interface InterviewRecord {
  id: string;
  employerId: string;
  candidateId: string;
  role: string | null;
  medium: string; // video | phone | onsite
  location: string | null;
  meetingLink: string | null;
  proposedSlots: string[] | null;
  scheduledAt: string | null;
  status: "proposed" | "confirmed" | "declined" | "cancelled" | "completed";
  message: string | null;
  /** Post-interview decision shared with the candidate (no-ghosting). */
  outcome: InterviewOutcome | null;
  outcomeNote: string | null;
  outcomeAt: string | null;
  createdAt: string;
  /** Present on candidate-side listings. */
  company?: string;
}

export interface ScorecardRating {
  label: string;
  score: number; // 1–4
}

/** Employer-private scorecard + the candidate-visible outcome. */
export interface Scorecard {
  id: string;
  outcome: InterviewOutcome | null;
  outcomeNote: string | null;
  feedback: {
    ratings: ScorecardRating[];
    recommendation: "strong_yes" | "yes" | "maybe" | "no" | null;
    notes: string | null;
  } | null;
}

export async function submitScorecard(
  interviewId: string,
  input: {
    ratings?: ScorecardRating[];
    recommendation?: "strong_yes" | "yes" | "maybe" | "no";
    notes?: string;
    outcome: InterviewOutcome;
    outcomeNote?: string;
  },
): Promise<InterviewRecord> {
  const res = await fetch(`${API_BASE_URL}/employers/hiring/interviews/${interviewId}/scorecard`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Failed to save scorecard");
  }
  return (await res.json()).data as InterviewRecord;
}

export async function getScorecard(interviewId: string): Promise<Scorecard> {
  const res = await fetch(`${API_BASE_URL}/employers/hiring/interviews/${interviewId}/scorecard`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load scorecard");
  return (await res.json()).data as Scorecard;
}

/** Proposes an interview (time slots) to a candidate. */
export async function proposeInterview(input: {
  candidateId: string;
  role?: string;
  medium?: "video" | "phone" | "onsite";
  location?: string;
  meetingLink?: string;
  proposedSlots: string[]; // ISO datetimes
  message?: string;
}): Promise<InterviewRecord> {
  const res = await fetch(`${API_BASE_URL}/employers/hiring/interviews`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Failed to propose interview");
  }
  return (await res.json()).data as InterviewRecord;
}

/** The signed-in candidate's interview invitations + scheduled interviews. */
export async function getMyInterviews(): Promise<InterviewRecord[]> {
  const res = await fetch(`${API_BASE_URL}/interviews/me`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load interviews");
  return ((await res.json()).data ?? []) as InterviewRecord[];
}

/** The employer's proposed/confirmed interviews (used to surface "join room" links). */
export async function getEmployerInterviews(): Promise<InterviewRecord[]> {
  const res = await fetch(`${API_BASE_URL}/employers/hiring/interviews`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load interviews");
  return ((await res.json()).data ?? []) as InterviewRecord[];
}

/** Candidate accepts (optionally picking a slot) or declines an invitation. */
export async function respondToInterview(
  id: string,
  action: "accept" | "decline",
  slot?: string,
): Promise<InterviewRecord> {
  const res = await fetch(`${API_BASE_URL}/interviews/${encodeURIComponent(id)}/respond`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action, slot }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Failed to respond");
  }
  return (await res.json()).data as InterviewRecord;
}

/** Sends the edited outreach (notification + email, consent-gated). */
export interface OutreachSendResult {
  success: boolean;
  id: string;
  /** Which channels actually delivered — 'both' means the email went out too. Null while scheduled. */
  channel: "notification" | "email" | "both" | null;
  /** Set when it was scheduled rather than sent: when it will arrive. */
  scheduledFor: string | null;
}

export async function sendOutreach(input: {
  candidateId: string;
  role?: string;
  subject: string;
  message: string;
  /** ISO time to deliver it instead of now — usually the start of their working day. */
  scheduledFor?: string;
}): Promise<OutreachSendResult> {
  const res = await fetch(`${API_BASE_URL}/employers/hiring/outreach/send`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Failed to send outreach");
  }
  return (await res.json()).data as OutreachSendResult;
}

/** Stops a scheduled message before it goes out. */
export async function cancelScheduledOutreach(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/employers/hiring/outreach/${id}/cancel`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Couldn't cancel that message");
  }
}

/** Working-hours advice for one candidate, from their own browser's timezone. */
export interface OutreachTiming {
  /** False when their timezone isn't known yet — then only `reason` is set. */
  known: boolean;
  timezone: string | null;
  /** Their local time now, e.g. "Tue 21:40". */
  localNow: string | null;
  goodNow: boolean;
  /** Next start of their working day (ISO), when now isn't a good time. */
  suggestedAt: string | null;
  /** The same moment in their time, e.g. "Wed 09:00". */
  suggestedLocal: string | null;
  reason: string;
}

export async function getOutreachTiming(candidateId: string): Promise<OutreachTiming> {
  const res = await fetch(`${API_BASE_URL}/employers/hiring/outreach/timing/${candidateId}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Couldn't check their local time");
  }
  return (await res.json()).data as OutreachTiming;
}

/* -------------------------------------------------------------------------- */
/*  How approaches land                                                       */
/* -------------------------------------------------------------------------- */

export type OutreachResponse = "INTERESTED" | "NOT_NOW" | "NOT_INTERESTED";

export interface OutreachStats {
  windowDays: number;
  sent: number;
  /**
   * How many the rates are drawn from. Messages under two days old are sent
   * but not yet judged, so this morning's batch does not drag the rate down.
   */
  judged: number;
  /** Opened in Coral. Email opens are deliberately not tracked. */
  openRate: number | null;
  replyRate: number | null;
  /** Of those who answered, how many said yes. */
  interestedRate: number | null;
  breakdown: { interested: number; notNow: number; notInterested: number; waiting: number };
  /**
   * Reply rate by the candidate's local send time. `comparison` stays null
   * until there are `minSample` judged messages with a known timezone.
   */
  timing?: {
    withTimezone: number;
    minSample: number;
    comparison: {
      inHours: { sent: number; replyRate: number };
      outOfHours: { sent: number; replyRate: number };
    } | null;
  };
}

export async function getOutreachStats(): Promise<OutreachStats> {
  const res = await fetch(`${API_BASE_URL}/employers/hiring/outreach/stats`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Failed to load outreach stats");
  }
  return (await res.json()).data as OutreachStats;
}

/** The latest approach to each candidate asked about, keyed by candidate id. */
export type ContactedMap = Record<
  string,
  {
    sentAt: string;
    /** Set while a message waits for their working hours. */
    scheduledFor?: string | null;
    response: "INTERESTED" | "NOT_NOW" | "NOT_INTERESTED" | null;
    answered: boolean;
  }
>;

/**
 * Which of these candidates the company has already approached.
 *
 * One request for a page of cards, rather than one per card — and it covers
 * colleagues' outreach, which is the case that matters: the reason to show this
 * at all is so nobody approaches the same person twice.
 */
export async function getContactedAmong(candidateIds: string[]): Promise<ContactedMap> {
  if (candidateIds.length === 0) return {};
  const res = await fetch(
    `${API_BASE_URL}/employers/hiring/outreach/contacted?ids=${encodeURIComponent(candidateIds.join(","))}`,
    { headers: await authHeaders() },
  );
  if (!res.ok) throw new Error("Failed to load outreach status");
  return ((await res.json()).data ?? {}) as ContactedMap;
}

/** One approach this company made to one person, and what came back. */
export interface OutreachToCandidate {
  id: string;
  subject: string;
  role: string | null;
  sentAt: string;
  sentBy: string;
  sentByMe: boolean;
  /** Opened **in Coral**. Null does not mean they never read the email. */
  openedAt: string | null;
  respondedAt: string | null;
  response: "INTERESTED" | "NOT_NOW" | "NOT_INTERESTED" | null;
  responseNote: string | null;
  conversationId: string | null;
}

/**
 * The company's outreach history with one candidate.
 *
 * The stats card answers "are we any good at this". This answers "what happened
 * with them", which is the question being asked when someone opens a profile —
 * and it replaces a "sent" marker that lived in browser state and was keyed by
 * name.
 */
export async function getOutreachForCandidate(
  candidateId: string,
): Promise<OutreachToCandidate[]> {
  const res = await fetch(
    `${API_BASE_URL}/employers/hiring/outreach/candidate/${encodeURIComponent(candidateId)}`,
    { headers: await authHeaders() },
  );
  if (!res.ok) throw new Error("Failed to load outreach history");
  return ((await res.json()).data?.messages ?? []) as OutreachToCandidate[];
}

/* -------------------------------------------------------------------------- */
/*  The candidate's side                                                      */
/* -------------------------------------------------------------------------- */

export interface ReceivedOutreach {
  id: string;
  /** The company, never the individual recruiter's personal details. */
  from: string;
  role: string | null;
  subject: string;
  message: string;
  sentAt: string;
  response: OutreachResponse | null;
  respondedAt: string | null;
  responseNote: string | null;
  /** Set once the candidate said they were interested. */
  conversationId: string | null;
}

/** Reads an approach. Opening it is the only "open" Coral records. */
export async function readOutreach(id: string): Promise<ReceivedOutreach> {
  const res = await fetch(`${API_BASE_URL}/outreach/${id}`, { headers: await authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Message not found");
  }
  return (await res.json()).data as ReceivedOutreach;
}

/**
 * Answers an approach. "Interested" opens a conversation with the company and
 * returns its id; the answer can be changed later.
 */
export async function respondToOutreach(
  id: string,
  response: OutreachResponse,
  note?: string,
): Promise<{ response: OutreachResponse; respondedAt: string; conversationId: string | null }> {
  const res = await fetch(`${API_BASE_URL}/outreach/${id}/respond`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ response, ...(note?.trim() ? { note: note.trim() } : {}) }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Could not send your answer");
  }
  return (await res.json()).data;
}
