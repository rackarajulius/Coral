/**
 * What a job posting states about itself, as the job form checks it. Mirrors
 * backend/src/jobs/posting-statements.ts, which the company page's checked
 * commitments are built from, so the form warns about exactly what will count.
 *
 * Ontario has required these in public postings by employers with 25 or more
 * employees since 2026-01-01. Coral can't know an employer's headcount, so the
 * form advises; nothing here blocks a posting.
 */

/** The widest range Ontario allows in a posting. */
export const PAY_RANGE_MAX_SPREAD = 50_000;
/** Roles paying more than this a year are exempt from the range rules. */
export const PAY_RANGE_RULE_CEILING = 200_000;

/** The form's answer to "is this role open now?"; "" is not stated yet. */
export type VacancyAnswer = "" | "open" | "future";

export function vacancyFromJob(existingVacancy: boolean | null | undefined): VacancyAnswer {
  return existingVacancy === true ? "open" : existingVacancy === false ? "future" : "";
}

/** For the API: true, false, or null to clear it back to "not stated". */
export function vacancyForJob(answer: VacancyAnswer): boolean | null {
  return answer === "open" ? true : answer === "future" ? false : null;
}

/** A yearly range wider than Ontario allows. Hourly pay can't break a $50,000 limit. */
export function payRangeTooWide(min: number, max: number, period: string): boolean {
  if (!min || !max) return false;
  if (!/^(year|yearly|annual|annually)?$/i.test(period.trim())) return false;
  if (max > PAY_RANGE_RULE_CEILING) return false;
  return max - min > PAY_RANGE_MAX_SPREAD;
}

const CANADIAN_EXPERIENCE = [
  /\bcanadian\s+(?:work\s+|job\s+|professional\s+|industry\s+)?experience\b/i,
  /\bexperience\s+(?:working\s+)?in\s+canada\b/i,
  /\bexp[ée]rience\s+(?:de\s+travail\s+)?canadienne\b/i,
];

/** Whether the text asks for Canadian experience, which Ontario postings can't. */
export function asksForCanadianExperience(text: string): boolean {
  return CANADIAN_EXPERIENCE.some((re) => re.test(text));
}

/** A location in Ontario, as people write it: "Toronto, ON", "Ottawa, Ontario, Canada". */
export function looksOntario(location: string): boolean {
  return /(^|[\s,])(on|ontario)([\s,]|$)/i.test(location.trim());
}
