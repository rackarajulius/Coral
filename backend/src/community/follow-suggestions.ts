/**
 * Who to suggest following, and the one reason given for each — as X's
 * "Who to follow" (x.com/i/connect_people), built on Coral's own facts.
 *
 * Pure: the service gathers the facts, this orders them. Every reason shown is
 * a fact the viewer could check for themselves — people they already follow,
 * a follow they received, a space they are in — never an inference about them
 * from private activity such as job applications.
 */

/** Below this many followers, "Popular in the community" would be an overstatement. */
export const POPULAR_FOLLOWERS = 3;

/** How far back "posting lately" and space activity look. */
export const RECENT_DAYS = 30;
export const SPACE_ACTIVITY_DAYS = 90;

/** How many suggestions one request returns; the list shows them a screenful at a time. */
export const MAX_SUGGESTIONS = 60;

export interface PersonSignals {
  id: string;
  /** People the viewer follows who follow this person. */
  followedBy: number;
  /** They follow the viewer, who does not follow them back. */
  followsYou: boolean;
  /** The space, among the viewer's, where they have been most active lately. */
  spaceId: string | null;
  spaceActivity: number;
  followers: number;
  recentPosts: number;
}

export interface CompanySignals {
  id: string;
  followedBy: number;
  followers: number;
  recentPosts: number;
}

export interface ProfessionalSignals {
  id: string;
  followedBy: number;
  followsYou: boolean;
  /** Based in the viewer's own city. */
  nearYou: boolean;
  followers: number;
}

export type ReasonKind = 'followed_by' | 'follows_you' | 'space' | 'near_you' | 'popular' | 'posting';

export interface Ranked {
  kind: 'person' | 'company';
  id: string;
  score: number;
  followers: number;
  reason: ReasonKind | null;
}

/**
 * The weights. Something tying the suggestion to the viewer — one person they
 * follow who follows them, or a follow received — always outweighs everything
 * a stranger can bring (reach plus posting, at most REACH_MAX + POSTING_MAX),
 * however popular: a suggestion for you should be about you.
 */
const FOLLOWED_BY = 12;
const FOLLOWS_YOU = 13;
const NEAR_YOU = 6;
const REACH_MAX = 6;
const POSTING_MAX = 3;

/** A follower count's worth, flattened and capped: the 1,000th follower says less than the 3rd. */
const reach = (followers: number) => Math.min(2 * Math.log2(1 + Math.max(followers, 0)), REACH_MAX);
const posting = (recentPosts: number) => Math.min(0.5 * Math.max(recentPosts, 0), POSTING_MAX);
/** Each person they share with the viewer counts, up to ten. */
const followedBy = (n: number) => FOLLOWED_BY * Math.min(n, 10);

export function personScore(s: PersonSignals): number {
  return (
    followedBy(s.followedBy) +
    (s.followsYou ? FOLLOWS_YOU : 0) +
    (s.spaceId ? 4 + Math.min(s.spaceActivity, 6) : 0) +
    reach(s.followers) +
    posting(s.recentPosts)
  );
}

export function companyScore(s: CompanySignals): number {
  return followedBy(s.followedBy) + reach(s.followers) + posting(s.recentPosts);
}

export function professionalScore(s: ProfessionalSignals): number {
  return followedBy(s.followedBy) + (s.followsYou ? FOLLOWS_YOU : 0) + (s.nearYou ? NEAR_YOU : 0) + reach(s.followers);
}

/** The strongest true thing to say about a person, or nothing. */
export function personReason(s: PersonSignals): ReasonKind | null {
  if (s.followedBy > 0) return 'followed_by';
  if (s.followsYou) return 'follows_you';
  if (s.spaceId) return 'space';
  if (s.followers >= POPULAR_FOLLOWERS) return 'popular';
  if (s.recentPosts > 0) return 'posting';
  return null;
}

export function companyReason(s: CompanySignals): ReasonKind | null {
  if (s.followedBy > 0) return 'followed_by';
  if (s.followers >= POPULAR_FOLLOWERS) return 'popular';
  if (s.recentPosts > 0) return 'posting';
  return null;
}

export function professionalReason(s: ProfessionalSignals): ReasonKind | null {
  if (s.followedBy > 0) return 'followed_by';
  if (s.followsYou) return 'follows_you';
  if (s.nearYou) return 'near_you';
  return null;
}

/** Best first; equal scores by reach, then by id so the order holds between visits. */
function byScore(a: Ranked, b: Ranked): number {
  return b.score - a.score || b.followers - a.followers || a.id.localeCompare(b.id);
}

/**
 * People and company pages in one list, as X mixes accounts. Ranked on the
 * same scale, so a company your follows follow sits beside a person they do.
 */
export function rankWhoToFollow(
  people: PersonSignals[],
  companies: CompanySignals[],
  limit = MAX_SUGGESTIONS,
): Ranked[] {
  return [
    ...people.map((s) => ({ kind: 'person' as const, id: s.id, score: personScore(s), followers: s.followers, reason: personReason(s) })),
    ...companies.map((s) => ({ kind: 'company' as const, id: s.id, score: companyScore(s), followers: s.followers, reason: companyReason(s) })),
  ]
    .sort(byScore)
    .slice(0, limit);
}

export function rankProfessionals(pros: ProfessionalSignals[], limit = MAX_SUGGESTIONS): Ranked[] {
  return pros
    .map((s) => ({ kind: 'person' as const, id: s.id, score: professionalScore(s), followers: s.followers, reason: professionalReason(s) }))
    .sort(byScore)
    .slice(0, limit);
}

export interface Place {
  city: string | null;
  /** The country as written ("Canada"). */
  country: string | null;
  /** ISO code, when the city was picked from Coral's list ("CA"). */
  countryCode?: string | null;
}

/** The same city, compared as people type them: case, accents and spacing aside. */
export function samePlace(a: Place | null, b: Place | null): boolean {
  const norm = (v: string | null | undefined) =>
    (v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!a || !b || !norm(a.city) || norm(a.city) !== norm(b.city)) return false;
  // Where both sides say which country, it must agree: London, Ontario is not
  // London, England. Codes are compared with codes and names with names.
  if (norm(a.countryCode) && norm(b.countryCode)) return norm(a.countryCode) === norm(b.countryCode);
  return !norm(a.country) || !norm(b.country) || norm(a.country) === norm(b.country);
}
