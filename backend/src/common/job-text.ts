/**
 * Reading the free-text fields jobs and profiles are made of.
 *
 * Titles, skills, levels, job types and locations are all typed by people, so
 * "Senior Backend Engineer" / "backend engineer II", "React" / "react", and
 * "mid" / "Mid Level" have to be made comparable before anything can match on
 * them. One file, so competitor insights and recommendations cannot come to
 * different conclusions about whether two titles are the same role.
 */

/**
 * Words that say how senior a role is, or how it's contracted, rather than
 * what it is. "Senior Backend Engineer" and "Backend Engineer" compete for the
 * same people; leaving these in would call them different roles.
 */
const TITLE_NOISE = new Set([
  'senior', 'sr', 'junior', 'jr', 'lead', 'principal', 'staff', 'head', 'chief',
  'associate', 'assistant', 'intern', 'internship', 'trainee', 'graduate', 'entry',
  'level', 'mid', 'i', 'ii', 'iii', 'iv', 'v',
  'the', 'a', 'an', 'of', 'and', 'for', 'to', 'in', 'at', 'with', 'on',
  'remote', 'hybrid', 'onsite', 'full', 'part', 'time', 'contract', 'temporary', 'temp',
  'freelance', 'permanent', 'fte',
]);

/** The words of a title that name the role, lower-cased. */
export function titleTokens(title: string | null | undefined): Set<string> {
  return new Set(
    (title ?? '')
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .map((t) => t.replace(/^\.+|\.+$/g, ''))
      .filter((t) => t.length > 0 && !TITLE_NOISE.has(t)),
  );
}

/** Some rows store one comma-joined string; split before comparing. */
export function skillSet(skills: readonly string[] | null | undefined): Set<string> {
  return new Set(
    (skills ?? [])
      .flatMap((s) => s.split(','))
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && s.length <= 60),
  );
}

/**
 * Ordered seniority bands. Stored values are free text ("mid", "Mid Level",
 * "entry level"), so they are read into one of these or into nothing.
 */
const LEVELS = ['entry', 'mid', 'senior', 'lead', 'executive'] as const;
export type Level = (typeof LEVELS)[number];

const LEVEL_WORDS: Record<string, Level> = {
  entry: 'entry', junior: 'entry', jr: 'entry', intern: 'entry', internship: 'entry',
  graduate: 'entry', trainee: 'entry', beginner: 'entry',
  mid: 'mid', intermediate: 'mid', middle: 'mid',
  senior: 'senior', sr: 'senior', experienced: 'senior',
  lead: 'lead', principal: 'lead', staff: 'lead', manager: 'lead',
  executive: 'executive', director: 'executive', head: 'executive', vp: 'executive', chief: 'executive',
};

export function normalizeLevel(level: string | null | undefined): Level | null {
  for (const word of (level ?? '').toLowerCase().split(/[^a-z]+/)) {
    if (LEVEL_WORDS[word]) return LEVEL_WORDS[word];
  }
  return null;
}

/** Steps between two bands: 0 same, 1 adjacent. Null when either is unknown. */
export function levelDistance(a: Level | null, b: Level | null): number | null {
  if (!a || !b) return null;
  return Math.abs(LEVELS.indexOf(a) - LEVELS.indexOf(b));
}

/** "Full Time", "full_time" and "fulltime" are one job type. */
export function normalizeJobType(type: string | null | undefined): string {
  return (type ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/^fulltime$/, 'full-time')
    .replace(/^parttime$/, 'part-time');
}

/**
 * Canadian province and territory codes, so "Toronto, ON" and "Ontario,
 * Canada" are recognisably the same place. Canada first because that is the
 * market; other codes are left as they are rather than guessed at.
 */
const PROVINCES: Record<string, string> = {
  on: 'ontario', bc: 'british columbia', ab: 'alberta', qc: 'quebec', mb: 'manitoba',
  sk: 'saskatchewan', ns: 'nova scotia', nb: 'new brunswick', nl: 'newfoundland',
  pe: 'prince edward island', yt: 'yukon', nt: 'northwest territories', nu: 'nunavut',
};

/** Words too generic to say two places are the same one. */
const PLACE_NOISE = new Set(['remote', 'hybrid', 'onsite', 'office', 'the', 'and', 'city', 'area', 'greater']);

/**
 * The place names in a person's location fields, with province codes expanded.
 *
 * Two-letter codes are only read as provinces when they stand alone after a
 * comma ("Toronto, ON"), so the word "on" in running text is not Ontario.
 */
export function placeTokens(...locations: (string | null | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const raw of locations) {
    if (!raw) continue;
    splitPlace(raw).forEach((words) => words.forEach((w) => out.add(w)));
  }
  return out;
}

/**
 * The city and province of a job's location — never its country.
 *
 * "Vancouver, BC, Canada" shares "canada" with every Canadian seeker; letting
 * that count would recommend on-site work across five time zones. A job
 * posted as just "Canada" keeps it, because there the country is the place.
 */
export function jobPlaceTokens(location: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!location) return out;
  splitPlace(location)
    .slice(0, 2)
    .forEach((words) => words.forEach((w) => out.add(w)));
  return out;
}

function splitPlace(raw: string): string[][] {
  const parts = raw.toLowerCase().split(',').map((p) => p.trim()).filter(Boolean);
  return parts.map((part, i) => {
    const expanded = i > 0 && PROVINCES[part] ? PROVINCES[part] : part;
    return expanded.split(/[^a-z]+/).filter((w) => w.length >= 3 && !PLACE_NOISE.has(w));
  });
}

export type RoleSimilarity = { kind: 'title' } | { kind: 'skills'; shared: string[] };

/**
 * The same role, or the same talent pool.
 *
 * Titles win when they agree: two "Backend Engineer" posts compete whatever
 * skills each happened to list. Otherwise it takes three shared skills, or
 * two that make up most of the shorter list — one shared skill ("Excel") says
 * nothing about who else wants these people.
 *
 * Shared by competitor insights and offer signals, so "similar roles on
 * Coral" means the same thing on both screens.
 */
export function roleSimilarity(
  titleA: Set<string>, skillsA: Set<string>,
  titleB: Set<string>, skillsB: Set<string>,
): RoleSimilarity | null {
  if (titleA.size > 0 && titleB.size > 0) {
    const common = [...titleA].filter((t) => titleB.has(t)).length;
    const union = new Set([...titleA, ...titleB]).size;
    if (common > 0 && common / union >= 0.5) return { kind: 'title' };
  }
  const shared = [...skillsA].filter((s) => skillsB.has(s));
  const smaller = Math.min(skillsA.size, skillsB.size);
  if (shared.length >= 3 || (shared.length >= 2 && shared.length / smaller >= 0.6)) {
    return { kind: 'skills', shared };
  }
  return null;
}

/** 'year'/'annually'/'per year' → 'yearly', and so on. Null when it isn't clear. */
export function normalizePayPeriod(period: string | null | undefined): 'yearly' | 'monthly' | 'hourly' | null {
  const p = (period ?? '').trim().toLowerCase();
  if (!p) return null;
  if (/(year|annual|annum|yr)/.test(p)) return 'yearly';
  if (/month/.test(p)) return 'monthly';
  if (/(hour|hr)/.test(p)) return 'hourly';
  return null;
}
