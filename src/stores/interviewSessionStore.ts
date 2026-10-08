import { create } from "zustand";
import { createEngine, type InterviewEngine } from "@/data/interview-coach/engine/InterviewEngine";
import { ApiInterviewEngine } from "@/data/interview-coach/engine/ApiInterviewEngine";
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
let serverBacked = false;
let pendingReport: SessionReport | null = null;
let finalizing = false;
let errorOperation: "answer" | "advance" | "finalize" | "screenIncomplete" | "abandon" | null = null;
let pendingEvaluation: { questionId: string; transcript: string; durationSec: number; typed: boolean } | null = null;

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
  resumeFromServer: (session: api.ServerSession) => Promise<void>;
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
    serverBacked,
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
          questionIndex: s.questionIndex + (q.isFollowUp ? 0 : 1),
          askedQuestions: [...s.askedQuestions, q],
          aiState: "speaking",
          utterance: utter(q.text, "question"),
          transcript: [...s.transcript, { speaker: "ai", text: q.text, at: stamp() }],
        }));
      } else {
        await finalize("completed");
      }
    } catch {
      errorOperation = "advance";
      set({ aiState: "error", error: "The interviewer lost its train of thought. Try resuming." });
    }
  }

  /** Generate the report, save history, and signal the screen to navigate. */
  async function finalize(status: HistoryEntry["status"]) {
    const s = get();
    if (!engine || !s.config || !s.sessionId || finalizing) return;
    finalizing = true;
    errorOperation = null;
    set({ aiState: "evaluating", utterance: null, error: null });
    try {
      const report = pendingReport ?? await engine.generateReport();
      pendingReport = report;

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
        localOnly: !serverBacked,
        createdAt: stamp(),
        config: s.config,
        durationSec: s.elapsedSec,
        overallScore: report.overallScore,
        improvementVsPrev: prev ? report.overallScore - prev.overallScore : undefined,
        status,
        report,
        answers: get().answers,
      };
      // Confirm the server write before claiming success or clearing recovery data.
      if (serverBacked) {
        await api.completeSession(s.sessionId);
      }

      useInterviewHistoryStore.getState().add(entry);
      pendingReport = null;
      clearStorage(STORAGE_KEYS.activeSession);
      set({ aiState: "idle", completedEntryId: entry.id });
    } catch (error) {
      errorOperation = "finalize";
      const detail = (error as Error)?.message?.trim();
      set({ aiState: "error", error: detail ? `Report wasn't saved: ${detail}. Try again.` : "Report wasn't saved. Try again." });
    } finally {
      finalizing = false;
    }
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
      if (existingSessionId) {
        const existing = await api.getSession(existingSessionId);
        if (existing.status === "active" && existing.answers.length > 0) {
          await get().resumeFromServer(existing);
          return existing.id;
        }
      }
      set({ config, aiState: "connecting", startedAt: now() });

      // A server id selects the AI engine. Basic scripted practice is used
      // only after the person explicitly chooses it in setup.
      let serverId: string | null = existingSessionId ?? null;
      if (!serverId && !options?.offline) {
        try {
          serverId = (await api.startSession(config)).id;
        } catch (error) {
          set({ aiState: "idle" });
          throw error;
        }
      }

      serverBacked = !!serverId;
      engine = createEngine(serverId);
      let started;
      try {
        started = await engine.startSession(config);
      } catch (error) {
        set({ aiState: "idle" });
        throw error;
      }
      const { sessionId, greeting, totalQuestions } = started;
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

    resumeFromServer: async (session) => {
      if (session.status !== "active") throw new Error("This interview is no longer active.");
      get().reset();
      serverBacked = true;
      set({ aiState: "connecting", config: session.config });
      try {
        const restored = new ApiInterviewEngine(session.id);
        const { greeting, totalQuestions } = await restored.startSession(session.config);
        const answers = session.answers ?? [];
        restored.restore(answers);
        engine = restored;
        const startedAt = now() - Math.max(0, session.durationSec) * 1000;
        set({
          sessionId: session.id,
          answers,
          liveScores: answers[answers.length - 1]?.evaluation.scores ?? { ...INITIAL_SCORES },
          askedQuestions: answers.map((a) => a.question),
          transcript: answers.flatMap((a) => [
            { speaker: "ai" as const, text: a.question.text, at: a.askedAt },
            { speaker: "you" as const, text: a.transcript, at: a.askedAt },
          ]),
          questionIndex: answers.filter((a) => !a.question.isFollowUp).length,
          totalQuestions,
          startedAt,
          elapsedSec: session.durationSec,
          aiState: "speaking",
          utterance: utter(greeting, "greeting"),
        });
        snapshot(get());
      } catch (error) {
        engine = null;
        set({ aiState: "error", error: (error as Error).message });
        throw error;
      }
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
      const submission = pendingEvaluation ?? {
        questionId: s.currentQuestion.id,
        transcript: transcriptText,
        durationSec,
        typed: s.textMode,
      };
      pendingEvaluation = submission;

      set((st) => ({
        aiState: "thinking",
        answerStartedAt: null,
      }));

      try {
        const evaluation = await engine.submitAnswer(submission);
        if (get().aiState === "idle") return;
        pendingEvaluation = null;

        const record: AnswerRecord = {
          questionId: s.currentQuestion.id,
          transcript: submission.transcript,
          durationSec: submission.durationSec,
          typed: submission.typed,
          question: s.currentQuestion,
          evaluation,
          askedAt: stamp(),
        };

        set((st) => ({
          liveScores: evaluation.scores,
          lastDelta: evaluation.delta,
          answers: [...st.answers, record],
          answerBuffer: "",
          transcript: submission.transcript
            ? [...st.transcript, { speaker: "you", text: submission.transcript, at: record.askedAt }]
            : st.transcript,
        }));
        snapshot(get());
        errorOperation = null;
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
        errorOperation = "answer";
        // Surface the server's reason — a generic message hides real causes
        // (bad payload, AI unconfigured) and makes this undebuggable.
        const detail = (e as Error)?.message?.trim();
        set({
          aiState: "error",
          error: detail
            ? `Evaluation failed: ${detail} Try again or end the interview.`
            : "Evaluation failed. Try again or end the interview.",
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
      if (s.aiState === "speaking" || s.aiState === "listening") {
        set({ aiState: "paused", answerStartedAt: null });
      }
    },

    resume: () => {
      const s = get();
      if (s.aiState === "error") {
        if (errorOperation === "finalize") void finalize("completed");
        else if (errorOperation === "answer") {
          set({ aiState: "listening", error: null, answerStartedAt: now() });
          void get().finishAnswer();
        } else if (errorOperation === "screenIncomplete" && s.currentQuestion) {
          set({ aiState: "speaking", error: null, utterance: utter(s.currentQuestion.text, "question") });
        } else if (errorOperation === "abandon") {
          void get().endEarly();
        } else void advance();
        return;
      }
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
      if (s.config?.screenMode && s.answers.filter((answer) => !answer.question.isFollowUp).length < s.totalQuestions) {
        errorOperation = "screenIncomplete";
        set({ aiState: "error", error: "Answer every assigned question before submitting this screening." });
        return;
      }
      if (s.answers.length >= 1) {
        await finalize("completed");
      } else {
        if (serverBacked && s.sessionId) {
          try {
            await api.abandonSession(s.sessionId);
          } catch (error) {
            errorOperation = "abandon";
            set({ aiState: "error", error: `Couldn't end this interview: ${(error as Error).message}` });
            return;
          }
        }
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
      serverBacked = false;
      pendingReport = null;
      finalizing = false;
      errorOperation = null;
      pendingEvaluation = null;
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
    localOnly: true,
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
