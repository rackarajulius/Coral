import {
  jobPlaceTokens,
  levelDistance,
  normalizeJobType,
  normalizeLevel,
  placeTokens,
  skillSet,
  titleTokens,
} from '../common/job-text';

/**
 * Whether a job suits a job seeker, and why.
 *
 * Deterministic and readable on purpose: every recommendation is shown with its
 * reasons, and an employer is told how many people a job reached, so the rules
 * have to be ones a person can check.
 *
 * **Only what the seeker declared about themselves** is read — their skills,
 * titles, keywords, the job types and places they said they want, and the
 * level they chose. Nothing is inferred (no computed years, no age-adjacent
 * proxy), and nothing here is chosen by the employer. The employer controls
 * the job; this decides who hears about it. Targeting employment ads by
 * seniority, function or place is the thing regulators went after LinkedIn and
 * Meta for, so the employer is given no such knob anywhere.
 *
 * Paying for a boost changes how far a job travels, never this score.
 */

/** The bar for recommending at all — for organic and boosted jobs alike. */
export const RECOMMEND_MIN_SCORE = 40;

/** Weights, out of 100. */
const W_SKILLS = 50;
const W_TITLE = 40;
/** Used alone when the job lists no skills: the title is all there is to go on. */
const W_TITLE_ONLY = 90;
const W_LEVEL = 5;
const W_PLACE = 5;
/**
 * Share of the job title's words a role string must contain to count as the
 * same role. Above a half, not at it: at 0.5 "Frontend Engineer" matched
 * "Backend Engineer" on the word "engineer". This way a two-word title needs
 * both words and a three-word title needs two.
 */
const TITLE_MIN = 0.6;

export interface MatchJob {
  title: string;
  skills: string[];
  experienceLevel: string | null;
  employmentType: string;
  location: string | null;
  isRemote: boolean;
  isHybrid: boolean;
}

export interface MatchProfile {
  skills: string[];
  keywords: string[];
  headline: string | null;
  currentTitle: string | null;
  jobTypes: string[];
  experienceLevel: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  preferredLocations: string[];
  remoteWork: boolean;
  remotePreference: string | null;
  willingToRelocate: boolean;
}

export interface MatchResult {
  /** 0-100. */
  score: number;
  /** Shown to the seeker, most important first. */
  reasons: string[];
}

/**
 * Null when the job is not for this person: a job type or place they ruled
 * out, or nothing in common at all. Otherwise a score and the reasons for it —
 * which may still be below RECOMMEND_MIN_SCORE.
 */
export function scoreJobForProfile(job: MatchJob, profile: MatchProfile): MatchResult | null {
  if (!jobTypeFits(job, profile)) return null;
  const place = placeFit(job, profile);
  if (!place.fits) return null;

  const reasons: string[] = [];
  let score = 0;

  // Skills: how much of what the job asks for the person says they have.
  const wanted = [...new Set(job.skills.flatMap((s) => s.split(',')).map((s) => s.trim()).filter(Boolean))];
  const held = skillSet([...profile.skills, ...profile.keywords]);
  const covered = wanted.filter((w) => holds(held, w.toLowerCase()));
  if (wanted.length > 0 && covered.length > 0) {
    score += W_SKILLS * (covered.length / wanted.length);
    const names = covered.slice(0, 3).join(', ');
    reasons.push(
      `${covered.length} of ${wanted.length} skills: ${names}${covered.length > 3 ? '…' : ''}`,
    );
  }

  // Title: is this the role they do, or say they want?
  const title = titleFit(job.title, profile);
  if (title.similarity >= TITLE_MIN) {
    score += (wanted.length > 0 ? W_TITLE : W_TITLE_ONLY) * title.similarity;
    reasons.unshift(`Similar to your role: ${title.matched}`);
  }

  // Nothing in common: not a recommendation, however near or well-levelled.
  if (covered.length === 0 && title.similarity < TITLE_MIN) return null;

  if (place.reason) {
    reasons.push(place.reason);
    if (place.named) score += W_PLACE;
  }

  // The seeker's own stated level. Ranks, never filters.
  const distance = levelDistance(normalizeLevel(job.experienceLevel), normalizeLevel(profile.experienceLevel));
  if (distance === 0) {
    score += W_LEVEL;
    reasons.push('At your level');
  } else if (distance === 1) {
    score += W_LEVEL / 2;
  }

  return { score: Math.min(100, Math.round(score)), reasons };
}

/**
 * Exact after lower-casing, or one contains the other when both are long
 * enough to mean something — so "PostgreSQL" holds "postgres", but "Go" does
 * not match inside "Django".
 */
function holds(held: Set<string>, skill: string): boolean {
  if (held.has(skill)) return true;
  if (skill.length < 4) return false;
  for (const h of held) {
    if (h.length >= 4 && (h.includes(skill) || skill.includes(h))) return true;
  }
  return false;
}

/**
 * The best of the person's role strings, by how much of the job title they
 * contain. Containment rather than overlap, because a headline is longer than
 * a title and should not be penalised for saying more.
 */
function titleFit(jobTitle: string, profile: MatchProfile): { similarity: number; matched: string } {
  const wanted = titleTokens(jobTitle);
  if (wanted.size === 0) return { similarity: 0, matched: '' };

  const candidates = [profile.currentTitle, profile.headline, ...profile.keywords].filter(
    (s): s is string => !!s && s.trim().length > 0,
  );
  let best = { similarity: 0, matched: '' };
  for (const role of candidates) {
    const tokens = titleTokens(role);
    const shared = [...wanted].filter((t) => tokens.has(t)).length;
    const similarity = shared / wanted.size;
    if (similarity > best.similarity) best = { similarity, matched: role.trim().slice(0, 60) };
  }
  return best;
}

/** Only when they listed job types: someone who wants contract work only said so. */
function jobTypeFits(job: MatchJob, profile: MatchProfile): boolean {
  const wanted = profile.jobTypes.map(normalizeJobType).filter(Boolean);
  if (wanted.length === 0) return true;
  return wanted.includes(normalizeJobType(job.employmentType));
}

/** Remote-only, as the seeker put it — not merely "open to remote". */
function wantsRemoteOnly(profile: MatchProfile): boolean {
  const pref = (profile.remotePreference ?? '').toLowerCase();
  return /remote/.test(pref) && !/(hybrid|onsite|on-site|office|any|flexible|open)/.test(pref);
}

/**
 * Can this person do this job from where they are, by their own account?
 *
 * Unknown is not "no": a profile with no location is not excluded from
 * on-site work, it just gets no location reason.
 */
function placeFit(job: MatchJob, profile: MatchProfile): { fits: boolean; reason?: string; named?: boolean } {
  // A place match for those who asked for remote work; just a fact for the rest.
  if (job.isRemote) return { fits: true, reason: 'Remote', named: profile.remoteWork || wantsRemoteOnly(profile) };
  if (wantsRemoteOnly(profile)) return { fits: false };

  const jobPlaces = jobPlaceTokens(job.location);
  if (jobPlaces.size === 0) return { fits: true };

  const theirs = placeTokens(profile.city, profile.state, profile.country, ...profile.preferredLocations);
  if (theirs.size === 0) return { fits: true };

  if ([...jobPlaces].some((p) => theirs.has(p))) {
    const where = (job.location ?? '').split(',')[0].trim();
    return { fits: true, reason: `${job.isHybrid ? 'Hybrid in' : 'In'} ${where}`, named: true };
  }
  if (profile.willingToRelocate) return { fits: true, reason: 'You’re open to relocating' };
  return { fits: false };
}
