import supabase from "@/lib/supabase";
import { errorFromBody } from "./entitlementError";
import type {
  AnswerRecord,
  HistoryEntry,
  InterviewConfig,
  LiveScores,
  Question,
  Readiness,
  SessionReport,
  TranscriptItem,
} from "@/data/interview-coach/types";

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

/** A coach session as stored on the server. */
export interface ServerSession {
  id: string;
  config: InterviewConfig;
  questions: Question[];
  answers: AnswerRecord[];
  transcript: TranscriptItem[];
  liveScores: LiveScores | null;
  questionIndex: number;
  status: "active" | "completed" | "abandoned";
  durationSec: number;
  startedAt: string;
  completedAt: string | null;
  report?: SessionReport | null;
}

/** A refusal about the job being practised for, rather than a connection problem. */
export class PracticeJobUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PracticeJobUnavailableError";
  }
}

export const isPracticeJobUnavailable = (e: unknown): e is PracticeJobUnavailableError =>
  e instanceof PracticeJobUnavailableError;

async function req<T>(path: string, init?: RequestInit, opts?: { practiceJob?: boolean }): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/interview-coach${path}`, {
    ...init,
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (opts?.practiceJob && res.status === 404) {
      throw new PracticeJobUnavailableError(
        (body as { message?: string }).message || "That job is no longer available to practise for.",
      );
    }
    // An allowance refusal keeps its code, so callers can offer an upgrade.
    throw errorFromBody(body, "Interview coach request failed");
  }
  return (await res.json()).data as T;
}

/** What the job page and the coach need to set up "Practice for this interview". */
export interface PracticeJob {
  id: string;
  title: string;
  /** The employer's company name; null when the job has none. */
  company: string | null;
  experienceLevel: string | null;
  skills: string[];
  /** Still published. A job you applied to stays practisable after it closes. */
  open: boolean;
}

/** 404 (PracticeJobUnavailableError) unless you applied to the job and haven't withdrawn. */
export function getPracticeJob(jobId: string) {
  return req<PracticeJob>(`/practice-job/${encodeURIComponent(jobId)}`, undefined, { practiceJob: true });
}

export function startSession(config: InterviewConfig, questions: Question[] = []) {
  return req<ServerSession>(
    "/sessions",
    { method: "POST", body: JSON.stringify({ config, questions }) },
    // Starting only 404s when the job being practised for is gone.
    { practiceJob: !!config.practiceJob },
  );
}

/** The still-running session, if any — used to resume after a refresh. */
export function getActiveSession() {
  return req<ServerSession | null>("/sessions/active");
}

export function getSession(id: string) {
  return req<ServerSession>(`/sessions/${id}`);
}

export function recordAnswer(
  id: string,
  input: {
    answer: AnswerRecord;
    liveScores?: LiveScores;
    transcript?: TranscriptItem[];
    questionIndex?: number;
    durationSec?: number;
  },
) {
  return req<ServerSession>(`/sessions/${id}/answers`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function completeSession(
  id: string,
  input: {
    report: SessionReport;
    overallScore: number;
    readiness: Readiness;
    durationSec?: number;
    status?: "completed" | "abandoned";
  },
) {
  return req<ServerSession>(`/sessions/${id}/complete`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function abandonSession(id: string) {
  return req<ServerSession>(`/sessions/${id}/abandon`, { method: "POST" });
}

/* ─── Resume parsing ─────────────────────────────────────────────────────── */

export interface ParsedResumeResponse {
  name: string;
  headline: string;
  summary: string;
  skills: string[];
  languages: string[];
  experiences: { title: string; company: string; location: string; period: string; description: string }[];
  educations: { degree: string; school: string; location: string; period: string; description: string }[];
}

/** Summary of the last resume this user parsed anywhere in the app. */
/**
 * The stored resume lives with the profile API now that the profile page
 * manages it. Re-exported here so the coach's own imports keep reading in one
 * place, and so there is only ever one definition of each.
 */
export {
  getMyResumeFile,
  deleteMyResumeFile,
  getStoredResumeSummary as getStoredResume,
  type StoredResumeFile,
  type StoredResumeSummary as StoredResume,
} from "./jobSeekerProfile";

/**
 * Real AI resume extraction (shared with the job-seeker profile importer).
 * Returns what's actually in the file — no invented projects or skills.
 */
export async function parseResumeFile(file: File): Promise<ParsedResumeResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE_URL}/job-seekers/me/resume/parse`, {
    method: "POST",
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Couldn't read that resume");
  }
  return (await res.json()).data as ParsedResumeResponse;
}

/* ─── AI engine ──────────────────────────────────────────────────────────── */

/** Plans the interview with the AI (greeting + role-specific questions). */
export function planSession(id: string) {
  return req<{ greeting: string; questions: Question[]; totalQuestions: number }>(
    `/sessions/${id}/plan`,
    { method: "POST" },
  );
}

/** Scores one spoken answer; `followUp` is a probe question when warranted. */
export function evaluateAnswer(
  id: string,
  input: { question: Question; answer: string; durationSec: number },
) {
  return req<{ scores: LiveScores; followUp: string | null; note: string }>(
    `/sessions/${id}/evaluate`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

/** AI debrief for the finished interview, grounded in the real transcript. */
export function buildReport(
  id: string,
  input: {
    finalScores: LiveScores;
    qa: { question: string; competency: string; answer: string }[];
  },
) {
  return req<{
    recommendation: string;
    strengths: string[];
    weaknesses: string[];
    repeatedMistakes: string[];
    focusAreas: string[];
    competencyInsights: { id: string; insight: string }[];
    sampleAnswers: { questionText: string; improved: string }[];
  }>(`/sessions/${id}/report`, { method: "POST", body: JSON.stringify(input) });
}

export function listSessions() {
  return req<ServerSession[]>("/sessions");
}

export function deleteSession(id: string) {
  return req<{ removed: boolean; id: string }>(`/sessions/${id}`, { method: "DELETE" });
}

/** Server session → the shape the history UI already renders. */
export function toHistoryEntry(s: ServerSession): HistoryEntry {
  return {
    id: s.id,
    createdAt: s.startedAt,
    config: s.config,
    durationSec: s.durationSec,
    overallScore: s.report?.overallScore ?? 0,
    status: s.status === "abandoned" ? "abandoned" : "completed",
    report: s.report ?? undefined,
    answers: s.answers ?? [],
  };
}

/* ─── Voice (ElevenLabs, proxied server-side) ────────────────────────────── */

/** A selectable interviewer voice, described by delivery style. */
export interface NeuralVoice {
  id: string;
  label: string;
  description: string;
}

export interface SpeechStatus {
  configured: boolean;
  voices: NeuralVoice[];
  defaultVoiceId: string | null;
}

const SPEECH_UNAVAILABLE: SpeechStatus = { configured: false, voices: [], defaultVoiceId: null };

/**
 * Whether high-quality voice is available here, and which voices the candidate
 * may choose. Unavailable is a normal state, not an error — callers fall back
 * to the browser's own voices.
 */
export async function getSpeechStatus(): Promise<SpeechStatus> {
  try {
    const res = await fetch(`${API_BASE_URL}/interview-coach/speech/status`, {
      headers: await authHeaders(),
    });
    if (!res.ok) return SPEECH_UNAVAILABLE;
    const data = (await res.json())?.data as Partial<SpeechStatus> | undefined;
    if (!data?.configured) return SPEECH_UNAVAILABLE;
    return {
      configured: true,
      voices: Array.isArray(data.voices) ? data.voices : [],
      defaultVoiceId: data.defaultVoiceId ?? null,
    };
  } catch {
    return SPEECH_UNAVAILABLE;
  }
}

/**
 * Synthesises Nova's speech. Returns an object URL for an <audio> element, or
 * null when unavailable — callers fall back to browser speech synthesis.
 */
export async function synthesizeSpeech(
  text: string,
  voiceId?: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/interview-coach/speech`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(voiceId ? { text, voiceId } : { text }),
      signal,
    });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null; // aborted, offline, or unconfigured
  }
}
