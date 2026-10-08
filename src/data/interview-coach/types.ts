// ─── AI Interview Coach — domain types ────────────────────────────────────────

export type ExperienceLevel =
  | "intern"
  | "junior"
  | "mid"
  | "senior"
  | "staff"
  | "principal";

export type InterviewType =
  | "hr"
  | "behavioral"
  | "technical"
  | "system-design"
  | "leadership"
  | "product"
  | "mixed";

/** 1 Beginner · 2 Intermediate · 3 Advanced · 4 Expert */
export type Difficulty = 1 | 2 | 3 | 4;

export type CompetencyId =
  | "communication"
  | "confidence"
  | "technicalDepth"
  | "problemSolving"
  | "structure";

export type AIState =
  | "connecting"
  | "speaking"
  | "listening"
  | "thinking"
  | "evaluating"
  | "paused"
  | "idle"
  | "error";

export interface ParsedResume {
  fileName: string;
  skills: string[];
  projects: string[];
  experienceYears: number;
  quality: "low" | "medium" | "high";
}

export interface InterviewConfig {
  role: string;
  experience: ExperienceLevel;
  type: InterviewType;
  difficulty: Difficulty;
  adaptive: boolean;
  language: string;
  voiceURI?: string;
  /**
   * The one name Nova greets the candidate by. Empty means no name; undefined
   * means not chosen yet, and the preferences step prefills it. See callName.ts.
   */
  callName?: string;
  /** 0.8 – 1.2 */
  speechRate: number;
  durationMin: number;
  questionCount: number;
  focusSkills: string[];
  micDeviceId?: string;
  resume?: ParsedResume;
  /**
   * This run is an employer screening, not self-practice: the questions are
   * fixed by the job, the result goes to the employer, and it ends on the
   * screening page rather than the coaching report.
   */
  screenMode?: boolean;
  /** Screening only — the AiScreen this run belongs to. */
  screenId?: string;
  /** Screening only — the company the candidate is being interviewed for. */
  company?: string;
  /**
   * Requested adjustments, applied to the interview itself rather than merely
   * recorded: `extraTime` lengthens the silence before an answer is treated as
   * finished, `startTyped` opens in typing mode instead of making the person
   * discover the fallback.
   */
  extraTime?: boolean;
  startTyped?: boolean;
  /**
   * Practising for one real job. Only `id` is trusted by the server, which
   * reads the posting itself and shapes the questions around it; the title
   * and company are for display.
   */
  practiceJob?: PracticeJobRef;
}

export interface PracticeJobRef {
  id: string;
  title: string;
  company: string | null;
}

export interface Question {
  id: string;
  text: string;
  competency: CompetencyId;
  keywords: string[];
  /** Ideal answer length in seconds — used for pacing feedback. */
  expectedSec: number;
  isFollowUp?: boolean;
  parentId?: string;
}

export interface SubmittedAnswer {
  questionId: string;
  transcript: string;
  durationSec: number;
  typed?: boolean;
}

/** Running competency scores, 0–100. */
export type LiveScores = Record<CompetencyId, number>;

export interface AnswerEvaluation {
  /** Smoothed running scores after this answer. */
  scores: LiveScores;
  /** Change vs the previous running scores (for +N animations). */
  delta: Partial<LiveScores>;
  fillerCount: number;
  wordCount: number;
  /** When present, the engine wants to probe deeper before advancing. */
  followUp?: Question;
}

export interface AnswerRecord extends SubmittedAnswer {
  question: Question;
  evaluation: AnswerEvaluation;
  askedAt: string;
}

export interface CompetencyResult {
  id: CompetencyId;
  score: number;
  /** Points vs the user's previous completed interview (if any). */
  trendVsPrev?: number;
  insight: string;
}

export interface SampleAnswer {
  questionText: string;
  original: string;
  improved: string;
  /** [start, end) char ranges in `improved` to highlight. */
  improvedRanges: [number, number][];
}

export type Readiness = "not-ready" | "getting-there" | "ready" | "strong";

export interface LearningResource {
  title: string;
  kind: "article" | "video" | "course" | "exercise";
  url: string;
  competency: CompetencyId;
  durationMin: number;
  reason: string;
}

export interface SessionReport {
  id: string;
  sessionId: string;
  overallScore: number;
  readiness: Readiness;
  recommendation: string;
  competencies: CompetencyResult[];
  strengths: string[];
  weaknesses: string[];
  repeatedMistakes: string[];
  focusAreas: string[];
  resources: LearningResource[];
  sampleAnswers: SampleAnswer[];
  responseDurations: { label: string; sec: number; expected: number }[];
}

export interface TranscriptItem {
  speaker: "ai" | "you";
  text: string;
  at: string;
  bookmarked?: boolean;
}

export interface HistoryEntry {
  id: string;
  /** Basic scripted practice is kept only for this browser tab. */
  localOnly?: boolean;
  createdAt: string;
  config: InterviewConfig;
  durationSec: number;
  overallScore: number;
  improvementVsPrev?: number;
  status: "completed" | "abandoned";
  report?: SessionReport;
  answers: AnswerRecord[];
}

/** Minimal crash-recovery snapshot written after each answer. */
export interface SessionSnapshot {
  sessionId: string;
  /** Basic practice has no server session and can only produce a local partial report. */
  serverBacked?: boolean;
  config: InterviewConfig;
  answers: AnswerRecord[];
  questionIndex: number;
  startedAt: string;
}
