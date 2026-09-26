import { create } from "zustand";
import {
  MOCK_CANDIDATES,
  type Candidate,
  type Stage,
  type TimelineEvent,
} from "@/data/employer/Candidates/types";
import type { Candidate as HACandidate } from "@/data/employer/HiringAssistant/Index";

// ─── HA pipeline stage → Candidates page Stage ────────────────────────────────

const HA_STAGE_MAP: Record<string, Stage> = {
  new:       "Applied",
  contacted: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer:     "Offer",
};

// ─── HA candidate → Full candidate conversion ─────────────────────────────────

function parseEducation(edu: string): { school: string; degree: string; year: string } {
  const parts = edu.split("·").map((s) => s.trim());
  return parts.length >= 2
    ? { degree: parts[0], school: parts[1], year: "" }
    : { school: edu, degree: "", year: "" };
}

function idFor(haName: string) {
  return `ha-${haName.toLowerCase().replace(/\s+/g, "-")}`;
}

function mapHAToFull(ha: HACandidate, roleTitle: string): Candidate {
  const timeline: TimelineEvent[] = [
    {
      id: crypto.randomUUID(),
      type: "applied",
      text: "Added via Hiring Assistant",
      at: new Date().toISOString().slice(0, 10),
    },
  ];

  return {
    id: idFor(ha.name),
    name: ha.name,
    initials: ha.initials,
    email: "",
    phone: "",
    currentRole: ha.role,
    currentCompany: ha.company,
    role: roleTitle,
    location: ha.location,
    stage: "Applied",
    matchScore: ha.match,
    appliedDate: new Date().toISOString().slice(0, 10),
    status: "Active",
    tags: ["AI-sourced", ...(ha.openToWork ? ["Open to Work"] : [])],
    // Derive per-skill match scores: first skill ≈ overall match, decreasing slightly
    skills: ha.skills.map((s, i) => ({
      name: s,
      match: Math.max(60, ha.match - i * Math.floor(ha.match * 0.04)),
    })),
    strengths: [ha.reason],
    concerns: [],
    summary: ha.reason,
    experience: [
      { title: ha.role, company: ha.company, period: `${ha.yearsExp} years` },
    ],
    education: [parseEducation(ha.education)],
    timeline,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface CandidateStoreState {
  candidates: Candidate[];
  /** Add a hiring-assistant candidate to the candidates page (idempotent). */
  addFromHiringAssistant: (ha: HACandidate, roleTitle: string) => void;
  /** Sync a candidate's stage when they move through the HA pipeline. */
  syncStage: (haName: string, haStageId: string) => void;
  moveTo: (id: string, stage: Stage) => void;
  reject: (id: string) => void;
  bulkMove: (ids: string[], stage: Stage) => void;
  bulkReject: (ids: string[]) => void;
  setStatus: (id: string, status: Candidate["status"]) => void;
  scheduleInterview: (id: string, details: { date: string; time: string; interviewType: string; note: string }) => void;
}

export const useCandidateStore = create<CandidateStoreState>((set) => ({
  candidates: MOCK_CANDIDATES,

  addFromHiringAssistant: (ha, roleTitle) =>
    set((s) => {
      if (s.candidates.some((c) => c.id === idFor(ha.name))) return s;
      return { candidates: [mapHAToFull(ha, roleTitle), ...s.candidates] };
    }),

  syncStage: (haName, haStageId) => {
    const stage = HA_STAGE_MAP[haStageId];
    if (!stage) return;
    const id = idFor(haName);
    set((s) => ({
      candidates: s.candidates.map((c) =>
        c.id === id && c.stage !== stage
          ? {
              ...c,
              stage,
              timeline: [
                ...c.timeline,
                {
                  id: crypto.randomUUID(),
                  type: "stage" as const,
                  text: `Moved to ${stage}`,
                  at: new Date().toISOString().slice(0, 10),
                },
              ],
            }
          : c
      ),
    }));
  },

  moveTo: (id, stage) =>
    set((s) => ({
      candidates: s.candidates.map((c) => (c.id === id ? { ...c, stage } : c)),
    })),

  reject: (id) =>
    set((s) => ({
      candidates: s.candidates.map((c) =>
        c.id === id ? { ...c, stage: "Rejected" as Stage } : c
      ),
    })),

  bulkMove: (ids, stage) => {
    const idSet = new Set(ids);
    set((s) => ({
      candidates: s.candidates.map((c) => (idSet.has(c.id) ? { ...c, stage } : c)),
    }));
  },

  bulkReject: (ids) => {
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
        const shouldAdvance = (["Applied", "Screening"] as Stage[]).includes(c.stage);
        return {
          ...c,
          stage: shouldAdvance ? ("Interview" as Stage) : c.stage,
          timeline: [...c.timeline, event],
        };
      }),
    })),
}));
