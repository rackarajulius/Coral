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

export type ScreenRecommendation = "strong_yes" | "yes" | "maybe" | "no";
export type ScreenStatus = "invited" | "completed" | "declined";
/** `live` = spoken conversation with the AI interviewer, scored like `text`. */
export type ScreenMode = "text" | "video" | "live";

export interface ScreenEvaluation {
  overallScore: number;
  recommendation: ScreenRecommendation;
  summary: string;
  strengths: string[];
  concerns: string[];
  perAnswer: { question: string; score: number; note: string }[];
}

export interface ScreenVideoAnswer {
  question: string;
  videoUrl: string;
}

/** Employer view of a screening (scorecard/videos present only via getScreen). */
export interface EmployerScreen {
  id: string;
  candidateId: string;
  /**
   * Set when sent from a job's applicant list. Screens sharing a jobId were
   * asked the same questions, so their scores can be compared; screens without
   * one cannot be ranked against them.
   */
  jobId: string | null;
  role: string | null;
  status: ScreenStatus;
  mode: ScreenMode;
  overallScore: number | null;
  recommendation: ScreenRecommendation | null;
  questionCount: number;
  createdAt: string;
  completedAt: string | null;
  evaluation?: ScreenEvaluation;
  /**
   * Observations about how the screening was taken. Context for a human, never
   * scored and never grounds for an automatic action — each has ordinary
   * explanations. `measured: false` means we never collected, which is not the
   * same as collecting and finding nothing.
   */
  integrity?: {
    notes: { code: "paste" | "away" | "similarity" | "latency"; detail: string }[];
    measured: boolean;
  };
  /** What the candidate asked for. Never why — that is not collected. */
  accommodations?: ScreenAccommodations | null;
  /** Video mode, completed: signed playback URLs per question. */
  videoAnswers?: ScreenVideoAnswer[];
}

/**
 * What a candidate needs to take a screening on equal terms. Records needs,
 * never reasons — there is no diagnosis field anywhere in this flow.
 */
export type AccommodationNeed =
  | "extra_time"
  | "typed_answers"
  | "human_interviewer"
  | "assistive_tech"
  | "other";

export interface ScreenAccommodations {
  needs: AccommodationNeed[];
  note: string | null;
  requestedAt: string;
  status: "requested" | "acknowledged";
  acknowledgedAt: string | null;
}

/** Candidate view — questions + status, no scores. */
export interface CandidateScreen {
  id: string;
  /** The job applied to, when the screening came from one. */
  jobId: string | null;
  role: string | null;
  company: string;
  status: ScreenStatus;
  mode: ScreenMode;
  questions: string[];
  /** Live mode: when they accepted the interview notice (null = not yet). */
  consentAt: string | null;
  accommodations: ScreenAccommodations | null;
  /** Video mode: which questions already have a recorded clip. */
  videoDone?: boolean[];
  createdAt: string;
  completedAt: string | null;
}

/* ------------------------------- employer ------------------------------- */

export async function inviteScreen(input: {
  candidateId: string;
  mode?: ScreenMode;
  role?: string;
  jobDescription?: string;
  questionCount?: number;
}): Promise<EmployerScreen> {
  const res = await fetch(`${API_BASE_URL}/employers/hiring/ai-screens`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Failed to send AI screening");
  }
  return (await res.json()).data as EmployerScreen;
}

/** The employer's screenings for one candidate (latest first). */
export async function getScreensForCandidate(candidateId: string): Promise<EmployerScreen[]> {
  const res = await fetch(
    `${API_BASE_URL}/employers/hiring/ai-screens?candidateId=${encodeURIComponent(candidateId)}`,
    { headers: await authHeaders() },
  );
  if (!res.ok) throw new Error("Failed to load screenings");
  return ((await res.json()).data ?? []) as EmployerScreen[];
}

export async function getScreenScorecard(id: string): Promise<EmployerScreen> {
  const res = await fetch(`${API_BASE_URL}/employers/hiring/ai-screens/${encodeURIComponent(id)}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load scorecard");
  return (await res.json()).data as EmployerScreen;
}

/* --------------------------- job-scoped screening ------------------------ */

/** The one question set every candidate for a job is asked. */
export interface JobScreeningQuestions {
  jobId: string;
  jobTitle: string;
  /** Empty until generated. */
  questions: string[];
  generatedAt: string | null;
  /** BCP-47 tag the round is conducted in. */
  language: string;
  applicantCount: number;
  screenCount: number;
}

export type ScreenSkipReason = "not_an_applicant" | "already_invited" | "cap_reached";

export interface BatchInviteResult {
  invited: EmployerScreen[];
  /** Candidates the server declined to invite, with the reason for each. */
  skipped: { candidateId: string; reason: ScreenSkipReason }[];
  questionCount: number;
  /** Screens still allowed for this job before the cap. */
  remaining: number;
  /** This round made the posting say AI is used to screen applicants. */
  postingNowSaysAi?: boolean;
}

const jobBase = (jobId: string) =>
  `${API_BASE_URL}/employers/hiring/jobs/${encodeURIComponent(jobId)}`;

export async function getJobScreeningQuestions(jobId: string): Promise<JobScreeningQuestions> {
  const res = await fetch(`${jobBase(jobId)}/screening-questions`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load screening questions");
  return (await res.json()).data as JobScreeningQuestions;
}

/** Creates the set, or replaces it when `regenerate` is true. */
/**
 * Languages a screening round can run in. Mirrors the server list — curated so
 * question quality, speech synthesis and recognition all hold up; a language
 * where any of those degrade would disadvantage candidates in a way the scorer
 * reads as a weak answer.
 */
export const SCREENING_LANGUAGES: { tag: string; name: string }[] = [
  { tag: "en-US", name: "English (US)" },
  { tag: "en-GB", name: "English (UK)" },
  { tag: "es-ES", name: "Spanish" },
  { tag: "fr-FR", name: "French" },
  { tag: "de-DE", name: "German" },
  { tag: "pt-BR", name: "Portuguese (Brazil)" },
  { tag: "it-IT", name: "Italian" },
  { tag: "nl-NL", name: "Dutch" },
  { tag: "pl-PL", name: "Polish" },
  { tag: "hi-IN", name: "Hindi" },
  { tag: "ar-SA", name: "Arabic" },
  { tag: "ja-JP", name: "Japanese" },
  { tag: "ko-KR", name: "Korean" },
  { tag: "zh-CN", name: "Chinese (Mandarin)" },
];

export async function generateJobScreeningQuestions(
  jobId: string,
  input: { questionCount?: number; regenerate?: boolean; language?: string } = {},
): Promise<JobScreeningQuestions> {
  const res = await fetch(`${jobBase(jobId)}/screening-questions`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Failed to generate screening questions");
  }
  return (await res.json()).data as JobScreeningQuestions;
}

/** One applicant's row on the screening board. */
export interface BoardRow {
  applicationId: string;
  candidateId: string;
  name: string;
  currentTitle: string | null;
  currentCompany: string | null;
  applicationStatus: string;
  stage: string | null;
  appliedAt: string;
  /** Null when this applicant was never invited to the round. */
  screen: {
    id: string;
    mode: ScreenMode;
    status: ScreenStatus;
    /** Null for video mode and anything unfinished — show "—", never a stand-in. */
    overallScore: number | null;
    recommendation: ScreenRecommendation | null;
    invitedAt: string;
    completedAt: string | null;
    durationSec: number | null;
    /** Live mode: whether they accepted the notice and began. */
    startedLive?: boolean;
  } | null;
}

export interface ScreeningBoard {
  jobId: string;
  jobTitle: string;
  questions: string[];
  generatedAt: string | null;
  rows: BoardRow[];
  summary: {
    applicants: number;
    invited: number;
    completed: number;
    declined: number;
    notInvited: number;
    scored: number;
  };
}

/** Every applicant for a job, ranked by screening result. */
export async function getScreeningBoard(jobId: string): Promise<ScreeningBoard> {
  const res = await fetch(`${jobBase(jobId)}/screening-board`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load the screening board");
  return (await res.json()).data as ScreeningBoard;
}

/** Screens already sent for this job, best score first. */
export async function getJobScreens(jobId: string): Promise<EmployerScreen[]> {
  const res = await fetch(`${jobBase(jobId)}/ai-screens`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load screenings");
  return ((await res.json()).data ?? []) as EmployerScreen[];
}

/** Invites many of a job's applicants at once, all on the same questions. */
export async function inviteScreenBatch(
  jobId: string,
  input: { candidateIds: string[]; mode?: ScreenMode },
): Promise<BatchInviteResult> {
  const res = await fetch(`${jobBase(jobId)}/ai-screens`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Failed to send screening invites");
  }
  return (await res.json()).data as BatchInviteResult;
}

/* ------------------------------ candidate ------------------------------- */

/** The signed-in candidate's screenings, newest first. */
export async function getMyScreens(): Promise<CandidateScreen[]> {
  const res = await fetch(`${API_BASE_URL}/ai-screens/me`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load your screenings");
  return (await res.json()).data as CandidateScreen[];
}

export async function getMyScreen(id: string): Promise<CandidateScreen> {
  const res = await fetch(`${API_BASE_URL}/ai-screens/${encodeURIComponent(id)}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(res.status === 404 ? "Screening not found" : "Failed to load screening");
  return (await res.json()).data as CandidateScreen;
}

/** Integrity observations — context for a human reviewer, never scored. */
export interface IntegritySignalsInput {
  pasteCount: number;
  pastedChars: number;
  blurCount: number;
  blurMs: number;
  latencies: number[];
}

export async function submitScreen(
  id: string,
  answers?: string[],
  integrity?: IntegritySignalsInput,
): Promise<CandidateScreen> {
  const res = await fetch(`${API_BASE_URL}/ai-screens/${encodeURIComponent(id)}/submit`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ ...(answers ? { answers } : {}), ...(integrity ? { integrity } : {}) }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Failed to submit");
  }
  return (await res.json()).data as CandidateScreen;
}

/** Uploads a recorded video answer for one question (video mode). Returns progress. */
export async function uploadScreenVideo(
  id: string,
  index: number,
  blob: Blob,
): Promise<{ index: number; uploaded: number; total: number }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const form = new FormData();
  form.append("file", blob, `answer-${index}.webm`);
  const res = await fetch(`${API_BASE_URL}/ai-screens/${encodeURIComponent(id)}/video/${index}`, {
    method: "POST",
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Failed to upload video");
  }
  return (await res.json()).data;
}

/* --------------------------- live screening ------------------------------ */

async function screenPost<T>(id: string, path: string, fallbackError: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/ai-screens/${encodeURIComponent(id)}/${path}`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || fallbackError);
  }
  return (await res.json()).data as T;
}

/** Requests adjustments for a screening. Needs only — never a reason. */
export async function requestAccommodations(
  id: string,
  input: { needs: AccommodationNeed[]; note?: string },
): Promise<ScreenAccommodations> {
  const res = await fetch(`${API_BASE_URL}/ai-screens/${encodeURIComponent(id)}/accommodations`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Couldn't send your request");
  }
  return (await res.json()).data as ScreenAccommodations;
}

/** Employer confirms they've seen the request; the candidate is told. */
export async function acknowledgeAccommodations(id: string): Promise<ScreenAccommodations> {
  const res = await fetch(
    `${API_BASE_URL}/employers/hiring/ai-screens/${encodeURIComponent(id)}/accommodations/acknowledge`,
    { method: "POST", headers: await authHeaders() },
  );
  if (!res.ok) throw new Error("Couldn't confirm");
  return (await res.json()).data as ScreenAccommodations;
}

/** Records acceptance of the AI-interview notice. Required before starting. */
export function consentToLiveScreen(id: string): Promise<{ consentAt: string }> {
  return screenPost(id, "live/consent", "Couldn't record your consent");
}

/**
 * Opens (or resumes) the single run for this screening. Returns the
 * interview-coach session that carries the conversation.
 */
export function startLiveScreen(
  id: string,
): Promise<{ sessionId: string; config: Record<string, unknown>; resumed: boolean }> {
  return screenPost(id, "live/start", "Couldn't start the interview");
}

/** Scores the finished run and notifies the employer. Safe to retry. */
export function completeLiveScreen(id: string): Promise<CandidateScreen> {
  return screenPost(id, "live/complete", "Couldn't submit the interview");
}

/**
 * The candidate's own coaching feedback from their interview.
 *
 * Intentionally has no overall score and no model answers: the employer's
 * score is a separate judgement, and every candidate in a round answers the
 * same questions, so improved answers would be an answer key.
 */
export interface ScreenFeedback {
  available: true;
  readiness: "not-ready" | "getting-there" | "ready" | "strong";
  competencies: { id: string; score: number; insight: string }[];
  strengths: string[];
  weaknesses: string[];
  repeatedMistakes: string[];
  focusAreas: string[];
  responseDurations: { label: string; sec: number; expected: number }[];
  durationSec: number | null;
}

export interface ScreenFeedbackUnavailable {
  available: false;
  reason: "not_started" | "not_ready";
}

export type ScreenFeedbackResult = ScreenFeedback | ScreenFeedbackUnavailable;

/** Type guard — the union doesn't narrow reliably through react-query's `data`. */
export function screenFeedbackReady(r: ScreenFeedbackResult): r is ScreenFeedback {
  return r.available;
}

export async function getScreenFeedback(id: string): Promise<ScreenFeedbackResult> {
  const res = await fetch(`${API_BASE_URL}/ai-screens/${encodeURIComponent(id)}/live/feedback`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Couldn't load your feedback");
  return (await res.json()).data as ScreenFeedbackResult;
}

export async function declineScreen(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/ai-screens/${encodeURIComponent(id)}/decline`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to decline");
}
