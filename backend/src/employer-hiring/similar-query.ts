/**
 * "Find people like this one", as a search the recruiter can read and edit.
 *
 * The answer is a query string rather than a hidden similarity score, so it
 * goes through the same search, ranking, saved searches and watchers as
 * anything typed by hand — and the recruiter can see exactly what "like this
 * person" was taken to mean, and tighten it.
 *
 * The shape is one OR group: their role, or any of their main skills. That is
 * a net, not a set of conditions. Requiring the title would find nobody in a
 * small pool (a "Senior Backend Engineer" is not a "Backend Developer"), and
 * the ranker is what puts the closest people first.
 */

/** Enough to say what someone does without sweeping in half the pool. */
const MAX_SKILLS = 6;
const MAX_TITLE_WORDS = 5;
/** Under the search box's own 500-character limit, with room to add a term. */
const MAX_QUERY_LENGTH = 400;

/**
 * Words about level, not about the work.
 *
 * Kept out of the title so a senior's search still finds people one step
 * below or above them, which is usually who a recruiter is after.
 */
const LEVEL_WORDS = new Set([
  'senior', 'sr', 'sr.', 'junior', 'jr', 'jr.', 'lead', 'principal', 'staff',
  'associate', 'intern', 'trainee', 'graduate', 'entry-level', 'mid-level',
]);

/** The parser's operators. A skill spelled like one would change the query. */
const OPERATORS = new Set(['AND', 'OR', 'NOT']);

export interface SimilarQuery {
  query: string;
  /** What it was built from, so the page can say so. */
  title: string | null;
  skills: string[];
}

export function buildSimilarQuery(profile: {
  currentTitle?: string | null;
  headline?: string | null;
  skills?: string[] | null;
}): SimilarQuery | null {
  const title = roleOf(profile.currentTitle) ?? roleOf(firstClause(profile.headline));

  const seen = new Set(title ? [title.toLowerCase()] : []);
  const skills: string[] = [];
  for (const raw of profile.skills ?? []) {
    const skill = sanitize(raw);
    if (!skill || OPERATORS.has(skill.toUpperCase())) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    skills.push(skill);
    if (skills.length === MAX_SKILLS) break;
  }

  // Long skill names give way from the end, where the least central ones are.
  while (skills.length > 0 && join(title, skills).length > MAX_QUERY_LENGTH) skills.pop();

  if (!title && skills.length === 0) return null;
  return { query: join(title, skills), title, skills };
}

/**
 * Every term quoted, so a two-word skill stays one term and the query is read
 * strictly — a bare list would be taken as a brief and split into words.
 */
function join(title: string | null, skills: string[]): string {
  return [...(title ? [title] : []), ...skills].map((t) => `"${t}"`).join(' OR ');
}

/** "Backend Engineer | AWS | Mentor" → "Backend Engineer". */
function firstClause(headline?: string | null): string | null {
  if (!headline) return null;
  return headline.split(/\s*(?:[|•·@,;]|\s-\s|\bat\b)\s*/i)[0] ?? null;
}

function roleOf(text?: string | null): string | null {
  const clean = sanitize(text);
  if (!clean) return null;
  const words = clean.split(/\s+/).filter((w) => !LEVEL_WORDS.has(w.toLowerCase()));
  return words.slice(0, MAX_TITLE_WORDS).join(' ') || null;
}

/**
 * Double quotes would end the phrase early, and a leading dash would turn the
 * term into an exclusion.
 */
function sanitize(text?: string | null): string {
  return (text ?? '').replace(/"/g, '').replace(/^-+/, '').replace(/\s+/g, ' ').trim();
}
