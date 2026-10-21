/**
 * What a job posting states about itself, and the checks behind the hiring
 * commitments a company page shows.
 *
 * Since 2026-01-01, Ontario's Employment Standards Act has required public
 * postings by employers with 25 or more employees to state pay (a figure, or a
 * range no wider than $50,000 for roles paying up to $200,000 a year), say
 * whether the role is an existing vacancy and whether AI is used to screen,
 * assess or select applicants, and not require "Canadian experience".
 *
 * Coral can't know an employer's headcount or where its staff are, so none of
 * this is enforced: postings carry the statements, employers are told what is
 * missing, and the company page shows what was found. Pay, a real vacancy and
 * honesty about AI are worth knowing in any province or country.
 */

/** The widest range Ontario allows in a posting. */
export const PAY_RANGE_MAX_SPREAD = 50_000;
/** Roles paying more than this a year are exempt from the range rules. */
export const PAY_RANGE_RULE_CEILING = 200_000;

interface Pay {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod?: string | null;
}

/** A pay figure or range is stated. Zero is how the job form says "none". */
export function statesPay(job: Pay): boolean {
  return !!job.salaryMin || !!job.salaryMax;
}

/**
 * A yearly range wider than Ontario allows. Only yearly pay is checked: the
 * $50,000 limit is about annual salary, and an hourly range can't break it.
 */
export function payRangeTooWide(job: Pay): boolean {
  if (!job.salaryMin || !job.salaryMax) return false;
  if (!/^(year|yearly|annual|annually)?$/i.test((job.salaryPeriod ?? '').trim())) return false;
  if (job.salaryMax > PAY_RANGE_RULE_CEILING) return false;
  return job.salaryMax - job.salaryMin > PAY_RANGE_MAX_SPREAD;
}

/** "Canadian experience", however it is put, in English or French. */
const CANADIAN_EXPERIENCE = [
  /\bcanadian\s+(?:work\s+|job\s+|professional\s+|industry\s+)?experience\b/i,
  /\bexperience\s+(?:working\s+)?in\s+canada\b/i,
  /\bexp[ée]rience\s+(?:de\s+travail\s+)?canadienne\b/i,
];

/** Whether any of the texts asks for Canadian experience, which Ontario postings can't. */
export function asksForCanadianExperience(...texts: Array<string | string[] | null | undefined>): boolean {
  const all = texts.flat().filter((t): t is string => typeof t === 'string');
  return all.some((text) => CANADIAN_EXPERIENCE.some((re) => re.test(text)));
}

/**
 * The statements a posting carries wherever it goes: its own page, and the
 * feeds and search listings that copy it, which must say the same.
 */
export function postingStatements(job: { existingVacancy: boolean | null; usesAi: boolean }): string[] {
  const out: string[] = [];
  if (job.existingVacancy === true) out.push('This posting is for an existing vacancy.');
  if (job.existingVacancy === false) {
    out.push('This posting is not for an existing vacancy: it gathers candidates for future openings.');
  }
  if (job.usesAi) out.push('Artificial intelligence is used to screen, assess or select applicants for this position.');
  return out;
}
