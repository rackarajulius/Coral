import type { MatchedJob } from "../api/resumeMatcher";

const EMPLOYER_BOARDS = new Set(["greenhouse", "lever", "ashby"]);

/**
 * Where to apply, as a button says it: "Apply on LinkedIn", "Apply on
 * Acme's site". Undefined for a web listing whose site is unknown.
 */
export function applySite(m: Pick<MatchedJob, "source" | "company" | "publishedOn">): string | undefined {
  if (m.publishedOn && !m.publishedOn.isEmployer) return m.publishedOn.name;
  if (m.publishedOn?.isEmployer || EMPLOYER_BOARDS.has(m.source)) return `${m.company}'s site`;
  if (m.source === "adzuna") return "Adzuna";
  return undefined;
}
