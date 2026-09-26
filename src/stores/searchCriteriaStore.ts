import { create } from "zustand";

/**
 * Server-side search criteria for candidate sourcing.
 *
 * Separate from the chips in `FiltersBar`, which only narrow the candidates
 * already on screen. These go to the server and change *which* candidates come
 * back, so they belong to the request, not to the result list.
 *
 * Shared through a store rather than passed down because two hooks issue the
 * same sourcing query — the workspace and the copilot — and react-query dedupes
 * them by key. Holding the criteria in one place keeps that key identical; the
 * alternative is two different requests and a copilot discussing candidates the
 * recruiter cannot see.
 */
export interface SearchCriteria {
  /** Matched against the candidate's city or country. */
  location: string;
  /** Every one of these must be on the profile. */
  skills: string[];
  seniority: string;
  industry: string;
  minYears?: number;
  maxYears?: number;
  remoteOnly: boolean;
  openToWorkOnly: boolean;
}

export const EMPTY_CRITERIA: SearchCriteria = {
  location: "",
  skills: [],
  seniority: "",
  industry: "",
  minYears: undefined,
  maxYears: undefined,
  remoteOnly: false,
  openToWorkOnly: false,
};

/** How many criteria are actually narrowing the search, for the UI's badge. */
export function activeCriteriaCount(c: SearchCriteria): number {
  return (
    (c.location ? 1 : 0) +
    c.skills.length +
    (c.seniority ? 1 : 0) +
    (c.industry ? 1 : 0) +
    (c.minYears !== undefined || c.maxYears !== undefined ? 1 : 0) +
    (c.remoteOnly ? 1 : 0) +
    (c.openToWorkOnly ? 1 : 0)
  );
}

interface SearchCriteriaState {
  criteria: SearchCriteria;
  setCriteria: (next: Partial<SearchCriteria>) => void;
  reset: () => void;
}

export const useSearchCriteria = create<SearchCriteriaState>((set) => ({
  criteria: EMPTY_CRITERIA,
  setCriteria: (next) => set((s) => ({ criteria: { ...s.criteria, ...next } })),
  reset: () => set({ criteria: EMPTY_CRITERIA }),
}));
