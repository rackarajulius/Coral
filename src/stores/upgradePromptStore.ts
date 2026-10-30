import { create } from "zustand";
import { onAfterSignOut } from "@/lib/signOutHooks";
import type { EntitlementCode } from "@/lib/api/entitlementError";
import type { SeekerMetric } from "@/lib/api/entitlements";

/**
 * What opened the plans. A refusal fills in all of it; a "See Premium" link
 * beside a feature gives only the feature and a line about it, and leaves
 * `code` out because nothing was refused.
 */
export interface UpgradePrompt {
  code?: EntitlementCode;
  /** The feature that led here; its row is picked out on the cards. */
  metric?: SeekerMetric;
  tier?: "free" | "premium";
  resetsAt?: string | null;
  message?: string;
  /**
   * Something free the person can do instead, offered next to "See Premium".
   * Always an explicit choice — never done silently on their behalf.
   */
  alternative?: { label: string; run: () => void };
}

interface UpgradePromptState {
  prompt: UpgradePrompt | null;
  show: (prompt: UpgradePrompt) => void;
  close: () => void;
}

/**
 * One upgrade dialog for the whole app: the plan cards.
 *
 * Any feature that hits its allowance calls `show` with the server's refusal,
 * and the dialog mounted once in the app renders it. Keeps the wording and the
 * "when does it come back" logic in one place instead of in every button.
 */
export const useUpgradePrompt = create<UpgradePromptState>((set) => ({
  prompt: null,
  show: (prompt) => set({ prompt }),
  close: () => set({ prompt: null }),
}));

// A prompt about one account's allowance never outlives that account's session.
onAfterSignOut(() => useUpgradePrompt.getState().close());
