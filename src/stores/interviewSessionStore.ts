import { create } from "zustand";
import { isEntitlementError } from "@/lib/api/entitlementError";
import { createEngine, type InterviewEngine } from "@/data/interview-coach/engine/InterviewEngine";
import { buildReport } from "@/data/interview-coach/engine/reportBuilder";
import { INITIAL_SCORES } from "@/data/interview-coach/engine/scoring";
import { STORAGE_KEYS, clearStorage, readStorage, writeStorage } from "@/data/interview-coach/storage";
import * as api from "@/lib/api/interviewCoach";
import type {
  AIState,
  AnswerRecord,
  HistoryEntry,
  InterviewConfig,
  LiveScores,
  Question,
  SessionReport,
  SessionSnapshot,
  TranscriptItem,
} from "@/data/interview-coach/types";
import { useInterviewHistoryStore } from "./interviewHistoryStore";

// The engine instance is non-serializable and lives beside the store, not in it.
let engine: InterviewEngine | null = null;

/** What the AI should be saying right now. `seq` retriggers TTS on replay. */
export interface Utterance {
  text: string;
  seq: number;
  /** Question utterances flow to `listening` when done; info ones don't. */
  kind: "greeting" | "question" | "info";
}

interface SessionState {
  sessionId: string | null;
  config: InterviewConfig | null;
  aiState: AIState;
  utterance: Utterance | null;
  currentQuestion: Question | null;
  /** Main questions asked so far (1-based once the first arrives). */
  questionIndex: number;
  totalQuestions: number;
  liveScores: LiveScores;
  lastDelta: Partial<LiveScores>;
  answers: AnswerRecord[];
  transcript: TranscriptItem[];
  askedQuestions: Question[];
  startedAt: number | null;
  elapsedSec: number;
  answerStartedAt: number | null;
  answerBuffer: string;
  muted: boolean;
  textMode: boolean;
  micDenied: boolean;
  /** Set when the report is saved — the session screen navigates to it. */
  completedEntryId: string | null;
  error: string | null;

  /**
   * Starts a run. `existingSessionId` attaches to a session the server already
   * created — an employer screening, where the row and its fixed questions
   * exist before the candidate begins.
   */
  begin: (
    config: InterviewConfig,
    existingSessionId?: string,
    /**
     * `offline`: run the basic scripted interviewer on purpose — free, not AI,
     * not saved. Only ever set by an explicit choice the person made.
     */
    options?: { offline?: boolean },
  ) => Promise<string>;
  /** TTS (or the muted-mode timer) finished delivering the current utterance. */
  onAISpeechEnd: () => void;
  appendFinalChunk: (text: string) => void;
  finishAnswer: () => Promise<void>;
  replayQuestion: () => void;
  pause: () => void;
  resume: () => void;
  endEarly: () => Promise<void>;
  tick: () => void;
  setMuted: (muted: boolean) => void;
  setTextMode: (on: boolean) => void;
  setMicDenied: (denied: boolean) => void;
  toggleBookmark: (index: number) => void;
  reset: () => void;
}

const now = () => Date.now();
const stamp = () => new Date().toISOString();

let utteranceSeq = 0;
const utter = (text: string, kind: Utterance["kind"]): Utterance => ({
  text,
  kind,
  seq: ++utteranceSeq,
});

function snapshot(s: Pick<SessionState, "sessionId" | "config" | "answers" | "questionIndex" | "startedAt">) {
  if (!s.sessionId || !s.config) return;
  const snap: SessionSnapshot = {
    sessionId: s.sessionId,
    config: s.config,
    answers: s.answers,
    questionIndex: s.questionIndex,
    startedAt: new Date(s.startedAt ?? now()).toISOString(),
  };
  writeStorage(STORAGE_KEYS.activeSession, snap);
}

export const useInterviewSessionStore = create<SessionState>((set, get) => {
  /** Ask the engine for the next main question, or wrap up if none remain. */
  async function advance() {
    if (!engine) return;
    set({ aiState: "thinking" });
    try {
      const q = await engine.nextQuestion();
      if (get().aiState === "idle") return; // reset while waiting
      if (q) {
        set((s) => ({
          currentQuestion: q,
          questionIndex: s.questionIndex + 1,
          askedQuestions: [...s.askedQuestions, q],
          aiState: "speaking",
          utterance: utter(q.text, "question"),
          transcript: [...s.transcript, { speaker: "ai", text: q.text, at: stamp() }],
        }));
      } else {
        await finalize("completed");
      }
    } catch {
      set({ aiState: "error", error: "The interviewer lost its train of thought. Try resuming." });
    }
  }

  /** Generate the report, save history, and signal the screen to navigate. */
  async function finalize(status: HistoryEntry["status"]) {
    const s = get();
    if (!engine || !s.config || !s.sessionId) return;
    set({ aiState: "evaluating", utterance: null, currentQuestion: null });

    const report = await engine.generateReport();

    // Decorate trends vs the previous completed interview.
    const prev = useInterviewHistoryStore
      .getState()
      .entries.find((e) => e.status === "completed" && e.report);
    if (prev?.report) {
      report.competencies.forEach((c) => {
        const p = prev.report!.competencies.find((x) => x.id === c.id);
        if (p) c.trendVsPrev = c.score - p.score;
      });
    }

    const entry: HistoryEntry = {
      id: s.sessionId,
      createdAt: stamp(),
      config: s.config,
      durationSec: s.elapsedSec,
      overallScore: report.overallScore,
      improvementVsPrev: prev ? report.overallScore - prev.overallScore : undefined,
      status,
      report,
      answers: get().answers,
    };
    useInterviewHistoryStore.getState().add(entry);

    // Persist the finished run + its report; history then reads from the server.
    api
      .completeSession(s.sessionId, {
        report,
        overallScore: report.overallScore,
        readiness: report.readiness,
        durationSec: s.elapsedSec,
        status,
      })
      .catch(() => undefined);

    clearStorage(STORAGE_KEYS.activeSession);
    set({ completedEntryId: entry.id });
  }

  return {
    sessionId: null,
    config: null,
    aiState: "idle",
    utterance: null,
    currentQuestion: null,
    questionIndex: 0,
    totalQuestions: 0,
    liveScores: { ...INITIAL_SCORES },
    lastDelta: {},
    answers: [],
    transcript: [],
    askedQuestions: [],
    startedAt: null,
    elapsedSec: 0,
    answerStartedAt: null,
    answerBuffer: "",
    muted: false,
    textMode: false,
    micDenied: false,
    completedEntryId: null,
    error: null,

    begin: async (config, existingSessionId, options) => {
      get().reset();
      set({ config, aiState: "connecting", startedAt: now() });

      // Create the server session first: its id both persists the run and tells
      // createEngine() to use the real LLM interviewer. If that fails (offline
      // or signed out) we fall back to the local simulator so practice still
      // works — it just isn't saved.
      //
      // A screening session already exists server-side, and must NOT fall back
      // to the simulator: an unsaved practice run can't be scored for an
      // employer, so a failure there has to surface rather than pretend.
      let serverId: string | null = existingSessionId ?? null;
      if (!serverId && !options?.offline) {
        try {
          serverId = (await api.startSession(config)).id;
        } catch (error) {
          /**
           * A plan refusal is not a connection problem. Falling back quietly
           * here would hand someone who has used their allowance a scripted
           * interviewer while they believe it is the AI coach. It is raised so
           * the caller can explain and offer that choice openly.
           */
          // Same for a job that can no longer be practised for: a scripted
          // run would silently not be about that job.
          if (isEntitlementError(error) || api.isPracticeJobUnavailable(error)) {
            set({ aiState: "idle" });
            throw error;
          }
          serverId = null;
        }
      }

      engine = createEngine(serverId);
      const { sessionId, greeting, totalQuestions } = await engine.startSession(config);
      const id = serverId ?? sessionId;

      set((s) => ({
        sessionId: id,
        totalQuestions,
        aiState: "speaking",
        utterance: utter(greeting, "greeting"),
        transcript: [...s.transcript, { speaker: "ai", text: greeting, at: stamp() }],
      }));
      return id;
    },

    onAISpeechEnd: () => {
      const s = get();
      if (s.aiState !== "speaking" || !s.utterance) return;
      if (s.utterance.kind === "greeting") {
        void advance();
      } else if (s.utterance.kind === "question") {
        set({ aiState: "listening", answerStartedAt: now(), answerBuffer: "" });
      }
    },

    appendFinalChunk: (text) =>
      set((s) => ({ answerBuffer: (s.answerBuffer + " " + text).trim() })),

    finishAnswer: async () => {
      const s = get();
      if (s.aiState !== "listening" || !s.currentQuestion || !engine) return;
      const transcriptText = s.answerBuffer.trim();
      const durationSec = s.answerStartedAt ? (now() - s.answerStartedAt) / 1000 : 0;

      set((st) => ({
        aiState: "thinking",
        answerStartedAt: null,
        transcript: transcriptText
          ? [...st.transcript, { speaker: "you", text: transcriptText, at: stamp() }]
          : st.transcript,
      }));

      try {
        const evaluation = await engine.submitAnswer({
          questionId: s.currentQuestion.id,
          transcript: transcriptText,
          durationSec,
          typed: s.textMode,
        });
        if (get().aiState === "idle") return;

        const record: AnswerRecord = {
          questionId: s.currentQuestion.id,
          transcript: transcriptText,
          durationSec,
          typed: s.textMode,
          question: s.currentQuestion,
          evaluation,
          askedAt: stamp(),
        };

        set((st) => ({
          liveScores: evaluation.scores,
          lastDelta: evaluation.delta,
          answers: [...st.answers, record],
          answerBuffer: "",
        }));
        snapshot(get());

        // Mirror the answer to the server so a refresh resumes where we left off.
        const after = get();
        if (after.sessionId) {
          api
            .recordAnswer(after.sessionId, {
              answer: record,
              liveScores: evaluation.scores,
              transcript: [{ speaker: "you", text: transcriptText, at: record.askedAt }],
              questionIndex: after.questionIndex,
              durationSec: after.elapsedSec,
            })
            .catch(() => undefined);
        }

        if (evaluation.followUp) {
          const fu = evaluation.followUp;
          set((st) => ({
            currentQuestion: fu,
            askedQuestions: [...st.askedQuestions, fu],
            aiState: "speaking",
            utterance: utter(fu.text, "question"),
            transcript: [...st.transcript, { speaker: "ai", text: fu.text, at: stamp() }],
          }));
        } else {
          await advance();
        }
      } catch (e) {
        // Surface the server's reason — a generic message hides real causes
        // (bad payload, AI unconfigured) and makes this undebuggable.
        const detail = (e as Error)?.message?.trim();
        set({
          aiState: "error",
          error: detail
            ? `Evaluation failed: ${detail} You can resume or end the interview.`
            : "Evaluation failed. You can resume or end the interview.",
        });
      }
    },

    replayQuestion: () => {
      const s = get();
      if (!s.currentQuestion) return;
      if (s.aiState !== "listening" && s.aiState !== "speaking" && s.aiState !== "paused") return;
      set({
        aiState: "speaking",
        utterance: utter(s.currentQuestion.text, "question"),
      });
    },

    pause: () => {
      const s = get();
      if (s.aiState === "speaking" || s.aiState === "listening" || s.aiState === "error") {
        set({ aiState: "paused", answerStartedAt: null });
      }
    },

    resume: () => {
      const s = get();
      if (s.aiState !== "paused") return;
      if (s.currentQuestion) {
        // Re-speak the current question so the candidate regains context.
        set({ aiState: "speaking", utterance: utter(s.currentQuestion.text, "question") });
      } else {
        void advance();
      }
    },

    endEarly: async () => {
      const s = get();
      if (s.answers.length >= 1) {
        await finalize("completed");
      } else {
        engine?.abort();
        clearStorage(STORAGE_KEYS.activeSession);
        set({ aiState: "idle", utterance: null });
      }
    },

    tick: () =>
      set((s) =>
        s.aiState === "paused" || s.aiState === "idle" || !s.startedAt
          ? s
          : { elapsedSec: Math.floor((now() - s.startedAt) / 1000) },
      ),

    setMuted: (muted) => set({ muted }),
    setTextMode: (on) => set({ textMode: on }),
    setMicDenied: (denied) => set({ micDenied: denied, textMode: denied ? true : get().textMode }),

    toggleBookmark: (index) =>
      set((s) => ({
        transcript: s.transcript.map((t, i) =>
          i === index ? { ...t, bookmarked: !t.bookmarked } : t,
        ),
      })),

    reset: () => {
      engine?.abort();
      engine = null;
      set({
        sessionId: null,
        config: null,
        aiState: "idle",
        utterance: null,
        currentQuestion: null,
        questionIndex: 0,
        totalQuestions: 0,
        liveScores: { ...INITIAL_SCORES },
        lastDelta: {},
        answers: [],
        transcript: [],
        askedQuestions: [],
        startedAt: null,
        elapsedSec: 0,
        answerStartedAt: null,
        answerBuffer: "",
        muted: false,
        textMode: false,
        micDenied: false,
        completedEntryId: null,
        error: null,
      });
    },
  };
});

// ─── Crash recovery ───────────────────────────────────────────────────────────

export function getRecoverySnapshot(): SessionSnapshot | null {
  return readStorage<SessionSnapshot>(STORAGE_KEYS.activeSession);
}

export function discardRecoverySnapshot() {
  clearStorage(STORAGE_KEYS.activeSession);
}

/** Build a partial report from an interrupted session's snapshot (no engine needed). */
export function recoverPartialReport(snap: SessionSnapshot): HistoryEntry {
  const finalScores = snap.answers.length
    ? snap.answers[snap.answers.length - 1].evaluation.scores
    : { ...INITIAL_SCORES };
  const report: SessionReport = buildReport({
    sessionId: snap.sessionId,
    config: snap.config,
    answers: snap.answers,
    finalScores,
  });
  const entry: HistoryEntry = {
    id: snap.sessionId,
    createdAt: stamp(),
    config: snap.config,
    durationSec: Math.max(
      60,
      Math.round((Date.now() - new Date(snap.startedAt).getTime()) / 1000),
    ),
    overallScore: report.overallScore,
    status: "completed",
    report,
    answers: snap.answers,
  };
  useInterviewHistoryStore.getState().add(entry);
  clearStorage(STORAGE_KEYS.activeSession);
  return entry;
}
