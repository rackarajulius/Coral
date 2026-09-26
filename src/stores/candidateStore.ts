import { create } from "zustand";
import { toast } from "sonner";
import {
  STAGES_BEFORE_INTERVIEW,
  type Candidate,
  type Stage,
  type TimelineEvent,
} from "@/data/employer/Candidates/types";
import { updateApplicantStage } from "@/lib/api/employerCandidates";
import { moveShortlistItemStage, type ShortlistStage } from "@/lib/api/shortlist";

/**
 * Sourced candidates arrive with a `sourced:<cardId>` id; applicants carry
 * their application's UUID.
 *
 * Both are now real, persisted rows — this used to distinguish server
 * applicants from session-local "ha-…" entries that existed only until the tab
 * was closed.
 */
const SOURCED_PREFIX = "sourced:";
const isSourced = (id: string) => id.startsWith(SOURCED_PREFIX);

/**
 * Saves a stage move to whichever record the row came from.
 *
 * An applicant's stage is their application's status; a sourced candidate's
 * lives on their shortlist card. When the two are linked the server moves both,
 * so it does not matter which board the recruiter was looking at.
 */
/**
 * Told when a stage write has actually landed on the server.
 *
 * The board tells the rest of the team a move happened, and it has to do that
 * **after** the write resolves. Announcing optimistically would have the other
 * browsers refetch before the write arrived, read the old stage, and then sit
 * on it — a sync that reliably shows stale data is worse than none.
 *
 * A module-level hook rather than a store field: this store is used outside
 * React too, and every stage write already funnels through one function.
 */
let onStagePersisted: (() => void) | null = null;

export function setStagePersistedListener(fn: (() => void) | null) {
  onStagePersisted = fn;
}

function persistStage(id: string, stage: Stage) {
  // The server's reason when it gave one — "Your role (Viewer) does not allow
  // this" is an answer; "didn't persist" sends people looking for a bug.
  const failed = (e?: unknown) =>
    toast.error("Couldn't save stage change", {
      description:
        (e instanceof Error && e.message) || "The move is shown locally but didn't persist.",
    });

  const landed = () => onStagePersisted?.();

  if (isSourced(id)) {
    // WITHDRAWN is the candidate's own act; the server refuses it here.
    if (stage === "Withdrawn") return;
    moveShortlistItemStage(id.slice(SOURCED_PREFIX.length), stage.toUpperCase() as ShortlistStage)
      .then(landed)
      .catch(failed);
    return;
  }
  updateApplicantStage(id, stage).then(landed).catch(failed);
}

/*
 * The hiring-assistant mirror lived here.
 *
 * It copied a sourced candidate into this board as a session-local row so the
 * two screens looked joined up. It never persisted, it keyed people by name,
 * and it INVENTED per-skill match percentages from the overall score. The
 * board now loads sourced candidates from the server alongside applicants,
 * so all of that is gone rather than maintained.
 */

// ─── Store ────────────────────────────────────────────────────────────────────

interface CandidateStoreState {
  candidates: Candidate[];
  /** Replace the board with the server-loaded page. */
  hydrate: (fetched: Candidate[]) => void;
  /** Adds the next page without dropping what is already shown. */
  append: (fetched: Candidate[]) => void;
  moveTo: (id: string, stage: Stage) => void;
  reject: (id: string) => void;
  bulkMove: (ids: string[], stage: Stage) => void;
  bulkReject: (ids: string[]) => void;
  setStatus: (id: string, status: Candidate["status"]) => void;
  scheduleInterview: (id: string, details: { date: string; time: string; interviewType: string; note: string }) => void;
}

export const useCandidateStore = create<CandidateStoreState>((set) => ({
  candidates: [],

  // The server is the whole truth now: applicants and sourced candidates both
  // come from one query, so there is nothing local left to preserve.
  hydrate: (fetched) => set({ candidates: fetched }),
  append: (fetched) =>
    set((s) => {
      // Guard against a page overlapping the previous one, which would render
      // duplicate rows with duplicate React keys.
      const seen = new Set(s.candidates.map((c) => c.id));
      return { candidates: [...s.candidates, ...fetched.filter((c) => !seen.has(c.id))] };
    }),

  moveTo: (id, stage) => {
    persistStage(id, stage);
    set((s) => ({
      candidates: s.candidates.map((c) => (c.id === id ? { ...c, stage } : c)),
    }));
  },

  reject: (id) => {
    persistStage(id, "Rejected");
    set((s) => ({
      candidates: s.candidates.map((c) =>
        c.id === id ? { ...c, stage: "Rejected" as Stage } : c
      ),
    }));
  },

  bulkMove: (ids, stage) => {
    ids.forEach((id) => persistStage(id, stage));
    const idSet = new Set(ids);
    set((s) => ({
      candidates: s.candidates.map((c) => (idSet.has(c.id) ? { ...c, stage } : c)),
    }));
  },

  bulkReject: (ids) => {
    ids.forEach((id) => persistStage(id, "Rejected"));
    const idSet = new Set(ids);
    set((s) => ({
      candidates: s.candidates.map((c) =>
        idSet.has(c.id) ? { ...c, stage: "Rejected" as Stage } : c
      ),
    }));
  },

  setStatus: (id, status) =>
    set((s) => ({
      candidates: s.candidates.map((c) => (c.id === id ? { ...c, status } : c)),
    })),

  scheduleInterview: (id, { date, time, interviewType, note }) =>
    set((s) => ({
      candidates: s.candidates.map((c) => {
        if (c.id !== id) return c;
        const dt = new Date(`${date}T${time}`);
        const displayDate = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const displayTime = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        const event: TimelineEvent = {
          id: crypto.randomUUID(),
          type: "interview",
          text: `Interview scheduled · ${displayDate} at ${displayTime} (${interviewType})${note ? ` — ${note}` : ""}`,
          at: new Date().toISOString().slice(0, 10),
        };
        const shouldAdvance = STAGES_BEFORE_INTERVIEW.includes(c.stage);
        if (shouldAdvance) persistStage(c.id, "Interview");
        return {
          ...c,
          stage: shouldAdvance ? ("Interview" as Stage) : c.stage,
          timeline: [...c.timeline, event],
        };
      }),
    })),
}));
