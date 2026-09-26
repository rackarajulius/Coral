/**
 * How well an applicant's skills cover a job's.
 *
 * Extracted so the write path, the recompute sweep and the SQL backfill all
 * agree. A stored score that disagrees with the one shown is worse than no
 * stored score, and the surest way to get there is two copies of this rule.
 *
 * The comparison stays as it was — bidirectional substring, so "react" matches
 * "react.js" and vice versa — because employers have already seen these numbers
 * and a score that shifts after a deploy has no explanation anyone can give.
 *
 * One deliberate change: blank entries are dropped. `"react".includes("")` is
 * true in JavaScript, so a single empty string in a candidate's skill list
 * matched *every* job skill and scored them 100%.
 */
export function computeMatchScore(
  jobSkills: readonly string[] | null | undefined,
  profileSkills: readonly string[] | null | undefined,
): number | null {
  const wanted = normalise(jobSkills);
  // Null, not zero: with nothing listed on the job there is nothing to compare,
  // which is a different statement from "matches none of it".
  if (wanted.length === 0) return null;

  const held = normalise(profileSkills);
  if (held.length === 0) return 0;

  const covered = wanted.filter((w) => held.some((h) => h.includes(w) || w.includes(h))).length;
  return Math.round((covered / wanted.length) * 100);
}

function normalise(skills: readonly string[] | null | undefined): string[] {
  return (skills ?? []).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0);
}
