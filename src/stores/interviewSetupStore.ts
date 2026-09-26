import { create } from "zustand";
import { DEFAULT_CONFIG } from "@/data/interview-coach/constants";
import type { InterviewConfig } from "@/data/interview-coach/types";

export const STEP_TITLES = [
  "Role & resume",
  "Experience",
  "Interview type",
  "Difficulty",
  "Preferences",
  "Review",
] as const;

export const TOTAL_STEPS = STEP_TITLES.length;

interface SetupState {
  /** Whether the setup wizard modal is visible. */
  open: boolean;
  step: number; // 1-based
  direction: 1 | -1;
  completed: number[];
  config: Partial<InterviewConfig>;
  /**
   * The person chose the basic scripted interviewer — free, not AI, not saved.
   * Set only by that explicit choice; the wizard then starts offline.
   */
  offlinePractice: boolean;
  openModal: (options?: { offlinePractice?: boolean }) => void;
  closeModal: () => void;
  set: (partial: Partial<InterviewConfig>) => void;
  next: () => void;
  back: () => void;
  goTo: (step: number) => void;
  /** Jump straight to Review with a previous session's config ("Practice again"). */
  prefillFrom: (config: InterviewConfig) => void;
  reset: () => void;
}

export function canProceed(step: number, config: Partial<InterviewConfig>): boolean {
  switch (step) {
    case 1:
      return !!config.role?.trim(); // resume is optional
    case 2:
      return !!config.experience;
    case 3:
      return !!config.type;
    case 4:
      return !!config.difficulty;
    default:
      return true; // preferences (5) has defaults; 6 is review
  }
}

export const useInterviewSetupStore = create<SetupState>((set) => ({
  open: false,
  step: 1,
  direction: 1,
  completed: [],
  config: { ...DEFAULT_CONFIG },
  offlinePractice: false,

  openModal: (options) => set({ open: true, offlinePractice: !!options?.offlinePractice }),
  closeModal: () => set({ open: false }),

  set: (partial) => set((s) => ({ config: { ...s.config, ...partial } })),

  next: () =>
    set((s) => ({
      step: Math.min(TOTAL_STEPS, s.step + 1),
      direction: 1,
      completed: s.completed.includes(s.step) ? s.completed : [...s.completed, s.step],
    })),

  back: () => set((s) => ({ step: Math.max(1, s.step - 1), direction: -1 })),

  goTo: (step) =>
    set((s) => ({
      step: Math.max(1, Math.min(TOTAL_STEPS, step)),
      direction: step > s.step ? 1 : -1,
    })),

  prefillFrom: (config) =>
    set({
      config: { ...config },
      step: TOTAL_STEPS,
      direction: 1,
      completed: Array.from({ length: TOTAL_STEPS - 1 }, (_, i) => i + 1),
    }),

  reset: () =>
    set({ step: 1, direction: 1, completed: [], config: { ...DEFAULT_CONFIG }, offlinePractice: false }),
}));
