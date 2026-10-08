import { create } from "zustand";
import { buildDemoHistory } from "@/data/interview-coach/demoData";
import { deleteSession, listSessions, toHistoryEntry } from "@/lib/api/interviewCoach";
import type { HistoryEntry, Readiness } from "@/data/interview-coach/types";

const MAX_ENTRIES = 50;

interface HistoryState {
  entries: HistoryEntry[]; // newest first
  loading: boolean;
  loaded: boolean;
  /** Fetches history from the server (replaces the old localStorage cache). */
  load: () => Promise<void>;
  add: (entry: HistoryEntry) => void;
  remove: (id: string) => void;
  clear: () => void;
  seedDemo: () => void;
}

/**
 * Interview history now lives server-side, so it survives a refresh, a cleared
 * browser, and follows the user across devices. `entries` is a local mirror of
 * the API response; mutations write through to the server.
 */
export const useInterviewHistoryStore = create<HistoryState>()((set) => ({
  entries: [],
  loading: false,
  loaded: false,

  load: async () => {
    set({ loading: true });
    try {
      const sessions = await listSessions();
      set((state) => ({
        entries: [
          ...state.entries.filter((entry) => entry.localOnly),
          ...sessions.map(toHistoryEntry),
        ].slice(0, MAX_ENTRIES),
        loading: false, loaded: true,
      }));
    } catch {
      // Keep whatever is on screen; the page shows its own empty/error state.
      set({ loading: false, loaded: true });
    }
  },

  // Optimistic — the session is already persisted by completeSession().
  add: (entry) => set((s) => ({ entries: [entry, ...s.entries].slice(0, MAX_ENTRIES) })),

  remove: (id) => {
    const localOnly = useInterviewHistoryStore.getState().entries.find((e) => e.id === id)?.localOnly;
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
    if (!localOnly) deleteSession(id).catch(() => undefined);
  },

  clear: () => set({ entries: [] }),

  seedDemo: () => set({ entries: buildDemoHistory() }),
}));

// ─── Derived stats (selectors — never stored) ─────────────────────────────────

export const selectCompleted = (s: HistoryState) =>
  s.entries.filter((e) => e.status === "completed");

export function getHistoryStats(entries: HistoryEntry[]) {
  const completed = entries.filter((e) => e.status === "completed");
  const total = completed.length;

  const avgScore = total
    ? Math.round(completed.reduce((a, e) => a + e.overallScore, 0) / total)
    : 0;

  const bestScore = total ? Math.max(...completed.map((e) => e.overallScore)) : 0;

  const avgDurationSec = total
    ? Math.round(completed.reduce((a, e) => a + e.durationSec, 0) / total)
    : 0;

  // Latest confidence competency score, if a report exists.
  const latestReport = completed.find((e) => e.report)?.report;
  const confidence =
    latestReport?.competencies.find((c) => c.id === "confidence")?.score ?? 0;

  const readiness: Readiness = latestReport?.readiness ?? "not-ready";

  // Practice streak: consecutive calendar days (ending today or yesterday) with a session.
  const days = new Set(completed.map((e) => new Date(e.createdAt).toDateString()));
  let streakDays = 0;
  const cursor = new Date();
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1); // grace: today not practiced yet
  while (days.has(cursor.toDateString())) {
    streakDays++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Oldest → newest score series for trend charts.
  const scoreTrend = [...completed]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((e) => ({
      date: e.createdAt,
      score: e.overallScore,
      role: e.config.role,
    }));

  const lastImprovement = completed[0]?.improvementVsPrev;

  return {
    total,
    avgScore,
    bestScore,
    avgDurationSec,
    confidence,
    readiness,
    streakDays,
    scoreTrend,
    lastImprovement,
  };
}

export const readinessLabel: Record<Readiness, string> = {
  "not-ready": "Warming up",
  "getting-there": "Getting there",
  ready: "Interview ready",
  strong: "Strong candidate",
};
