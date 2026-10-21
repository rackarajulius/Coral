import type { EmploymentType, MatchedJob, Workplace } from "../api/resumeMatcher";

export const WORKPLACE_LABELS: Record<Workplace, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
};

export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  temporary: "Temporary",
  internship: "Internship",
};

export type MatchSort = "best" | "pay" | "newest";
/** Days back; 0 is any time. */
export type PostedWithin = 0 | 1 | 3 | 7 | 30;

export interface MatchFilters {
  sort: MatchSort;
  postedWithin: PostedWithin;
  /** Empty means any workplace. */
  workplaces: Workplace[];
  employmentType: EmploymentType | "any";
  /** Yearly pay at least this much; 0 is any. */
  minYearlyPay: number;
}

export const DEFAULT_FILTERS: MatchFilters = {
  sort: "best",
  postedWithin: 0,
  workplaces: [],
  employmentType: "any",
  minYearlyPay: 0,
};

/** Whether anything narrows the list (sorting doesn't). */
export function isFiltering(f: MatchFilters): boolean {
  return f.postedWithin > 0 || f.workplaces.length > 0 || f.employmentType !== "any" || f.minYearlyPay > 0;
}

/** The highest yearly pay a match states, or undefined when it states none. */
export function topYearlyPay(m: MatchedJob): number | undefined {
  return m.yearlyPay?.max ?? m.yearlyPay?.min;
}

function postedTime(m: MatchedJob): number | undefined {
  const t = m.postedAt ? Date.parse(m.postedAt) : NaN;
  return Number.isNaN(t) ? undefined : t;
}

/**
 * Narrows and orders matches on the page.
 *
 * A filter keeps only jobs that state what it asks about: a job that doesn't
 * say whether it's remote is not shown as remote, and one with no stated pay
 * doesn't pass a pay floor. Sorting puts jobs that don't state the thing
 * sorted on last, in their match order.
 */
export function applyMatchFilters(matches: MatchedJob[], f: MatchFilters, now = Date.now()): MatchedJob[] {
  const since = f.postedWithin > 0 ? now - f.postedWithin * 24 * 3600_000 : undefined;
  const kept = matches.filter((m) => {
    if (since !== undefined) {
      const t = postedTime(m);
      if (t === undefined || t < since) return false;
    }
    if (f.workplaces.length > 0 && (!m.workplace || !f.workplaces.includes(m.workplace))) return false;
    if (f.employmentType !== "any" && m.employmentType !== f.employmentType) return false;
    if (f.minYearlyPay > 0 && (topYearlyPay(m) ?? 0) < f.minYearlyPay) return false;
    return true;
  });

  if (f.sort === "best") return kept;
  const value = f.sort === "pay" ? topYearlyPay : postedTime;
  // Stable: ties and unknowns keep their match order.
  return kept
    .map((m, i) => ({ m, i, v: value(m) }))
    .sort((a, b) => {
      if (a.v === undefined && b.v === undefined) return a.i - b.i;
      if (a.v === undefined) return 1;
      if (b.v === undefined) return -1;
      return b.v - a.v || a.i - b.i;
    })
    .map(({ m }) => m);
}

/** "Today", "Yesterday", "3d ago", "2w ago", "4mo ago" — or undefined without a date. */
export function postedAgo(postedAt: string | undefined, now = Date.now()): string | undefined {
  const t = postedAt ? Date.parse(postedAt) : NaN;
  if (Number.isNaN(t)) return undefined;
  const days = Math.max(0, Math.floor((now - t) / (24 * 3600_000)));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
