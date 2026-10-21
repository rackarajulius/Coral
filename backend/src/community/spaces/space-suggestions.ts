/**
 * Which spaces to suggest, and why — the parts that need no database.
 *
 * Every suggestion carries one reason in plain words, taken from whichever
 * signal contributed most. There is no score on screen: "You've commented on
 * 3 posts here" is something a person can check against their own memory, and
 * a number is not.
 *
 * The reasons only ever describe the viewer's own actions, or a count of
 * people large enough not to point at anyone.
 */

/** Things someone did in a space they have not joined. */
export const SIGNAL_KINDS = ['comment', 'post', 'reshare', 'tide', 'bookmark', 'vote', 'like'] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

/**
 * How much one fresh action says about wanting to be in a space.
 *
 * Writing something (a comment, a post) is the strongest: it is taking part
 * already, and joining is only making it official. A like is the cheapest
 * thing to give, so it counts least.
 */
export const SIGNAL_WEIGHTS: Record<SignalKind, number> = {
  comment: 4,
  post: 4,
  reshare: 3,
  tide: 3,
  bookmark: 2,
  vote: 1.5,
  like: 1,
};

/** An action this old counts half as much as one made today. */
export const HALF_LIFE_DAYS = 60;

/** Older than this is not looked at all. */
export const LOOKBACK_DAYS = 365;

/**
 * The fewest people from your spaces who must share another before it is
 * suggested on their account.
 *
 * Below it, "joined by 1 member of Career Growth" all but names them — and a
 * single person's choices say little about a group's taste anyway.
 */
export const MIN_SHARED_MEMBERS = 3;

/**
 * Spaces bigger than this are not used to find people like you.
 *
 * Everybody is in the biggest rooms, so sharing one says nothing — and
 * following every member of a large space out to every other space they joined
 * is the query that would get slow first.
 */
export const MAX_PEER_SPACE_SIZE = 2000;

const PEER_WEIGHT = 1.5;
const PROFILE_TERM_WEIGHT = 1.5;
const MAX_PROFILE_TERMS = 2;

/* ---------------------------------- input --------------------------------- */

/** The viewer's own activity in one space, summed by kind. */
export interface ActivityRow {
  spaceId: string;
  kind: SignalKind;
  /** Distinct things: posts commented on, polls voted in, tides signed up for. */
  count: number;
  /** Each action counted as 0.5^(age / half-life), then summed. */
  recency: number;
}

/**
 * People who share a space with the viewer and also joined this one.
 *
 * One row per (space, shared space), plus one total per space with
 * `viaSpaceId` null — the total is not the sum, because one person can share
 * several spaces with you.
 */
export interface PeerRow {
  spaceId: string;
  viaSpaceId: string | null;
  members: number;
}

export interface CandidateSpace {
  id: string;
  name: string;
  description: string | null;
  postCount: number;
}

/** What the viewer said about themselves. All optional. */
export interface ProfileTerms {
  skills: string[];
  title: string | null;
  industry: string | null;
}

/* --------------------------------- output --------------------------------- */

export type ReasonKind = 'activity' | 'peers' | 'profile' | 'popular';

export interface SuggestionReason {
  kind: ReasonKind;
  text: string;
}

export interface RankedSuggestion {
  spaceId: string;
  score: number;
  reason: SuggestionReason;
}

/* ------------------------------- the ranking ------------------------------ */

/**
 * Orders candidates by what the viewer has done, then fills with popular ones.
 *
 * `candidates` must already exclude spaces the viewer joined or dismissed, and
 * arrive busiest first — that order is what the fill uses, so a space nobody
 * has a reason to suggest still lands in a sensible place.
 *
 * A space with no posts is only suggested when people you share spaces with
 * joined it. A profile match or popularity alone would be pointing someone at
 * an empty room, which is the one thing a suggestion must not do.
 */
export function rankSuggestions(input: {
  candidates: CandidateSpace[];
  activity: ActivityRow[];
  peers: PeerRow[];
  profile: ProfileTerms;
  /** Names of the viewer's own spaces, for "Joined by 4 members of …". */
  spaceNames: Map<string, string>;
  limit: number;
}): RankedSuggestion[] {
  const { candidates, activity, peers, profile, spaceNames, limit } = input;

  const activityBySpace = groupBy(activity, (a) => a.spaceId);
  const peersBySpace = groupBy(peers, (p) => p.spaceId);
  const terms = profileTerms(profile);

  const scored: RankedSuggestion[] = [];
  const unscored: RankedSuggestion[] = [];

  for (const space of candidates) {
    const parts: { score: number; reason: SuggestionReason }[] = [];

    const acted = activityPart(activityBySpace.get(space.id) ?? []);
    if (acted) parts.push(acted);

    const shared = peerPart(peersBySpace.get(space.id) ?? [], spaceNames);
    if (shared) parts.push(shared);

    if (space.postCount > 0) {
      const matched = profilePart(space, terms);
      if (matched) parts.push(matched);
    }

    if (parts.length === 0) {
      if (space.postCount > 0) {
        unscored.push({
          spaceId: space.id,
          score: 0,
          reason: { kind: 'popular', text: 'Popular in the community' },
        });
      }
      continue;
    }

    // The reason is the single biggest part, not a list of everything: one
    // line a person can check is worth more than three they have to weigh.
    // Ties go to the order the parts were added — what you did, then who
    // else is there, then what your profile says.
    const best = parts.reduce((a, b) => (b.score > a.score ? b : a));
    scored.push({
      spaceId: space.id,
      score: round(parts.reduce((sum, p) => sum + p.score, 0)),
      reason: best.reason,
    });
  }

  // Stable sort: equal scores keep the busiest-first order they arrived in.
  scored.sort((a, b) => b.score - a.score);
  return [...scored, ...unscored].slice(0, Math.max(limit, 0));
}

/* ---------------------------------- parts --------------------------------- */

/**
 * What the viewer did there.
 *
 * Each kind gives diminishing returns — `log2(1 + recency)` — so one fresh
 * action is worth exactly its weight, and the fiftieth like in one space does
 * not drown out a comment somewhere else.
 */
function activityPart(rows: ActivityRow[]): { score: number; reason: SuggestionReason } | null {
  let total = 0;
  let lead: { row: ActivityRow; score: number } | null = null;

  for (const row of rows) {
    if (row.count <= 0 || row.recency <= 0) continue;
    const score = SIGNAL_WEIGHTS[row.kind] * Math.log2(1 + row.recency);
    total += score;
    if (!lead || score > lead.score) lead = { row, score };
  }

  if (!lead) return null;
  return {
    score: total,
    reason: { kind: 'activity', text: activityText(lead.row.kind, lead.row.count) },
  };
}

function peerPart(
  rows: PeerRow[],
  spaceNames: Map<string, string>,
): { score: number; reason: SuggestionReason } | null {
  const total = rows.find((r) => r.viaSpaceId === null);
  if (!total || total.members < MIN_SHARED_MEMBERS) return null;

  // Named after the shared space most of them came through. Its own count is
  // what the line states — "4 members of Career Growth" has to be true of
  // Career Growth — and it is only named when that count clears the bar too.
  const via = rows
    .filter((r) => r.viaSpaceId !== null && spaceNames.has(r.viaSpaceId))
    .sort((a, b) => b.members - a.members)[0];

  const text =
    via && via.members >= MIN_SHARED_MEMBERS
      ? `Joined by ${via.members} members of ${spaceNames.get(via.viaSpaceId!)}`
      : `Joined by ${total.members} people in your spaces`;

  return {
    score: PEER_WEIGHT * Math.log2(1 + total.members),
    reason: { kind: 'peers', text },
  };
}

function profilePart(
  space: CandidateSpace,
  terms: ProfileTerm[],
): { score: number; reason: SuggestionReason } | null {
  if (terms.length === 0) return null;
  const haystack = ` ${normalize(`${space.name} ${space.description ?? ''}`)} `;

  const matched = terms.filter((t) => haystack.includes(` ${t.normalized} `)).slice(0, MAX_PROFILE_TERMS);
  if (matched.length === 0) return null;

  const sources = new Set(matched.map((t) => t.source));
  const label =
    sources.size > 1
      ? 'Matches your profile'
      : sources.has('skill')
        ? matched.length > 1 ? 'Matches your skills' : 'Matches your skill'
        : sources.has('title')
          ? 'Matches your role'
          : 'Matches your industry';

  return {
    score: PROFILE_TERM_WEIGHT * matched.length,
    reason: { kind: 'profile', text: `${label}: ${matched.map((t) => t.display).join(', ')}` },
  };
}

/* ---------------------------------- words --------------------------------- */

export function activityText(kind: SignalKind, n: number): string {
  const one = n === 1;
  switch (kind) {
    case 'comment':
      return one ? 'You commented on a post here' : `You've commented on ${n} posts here`;
    case 'post':
      return one ? "You've posted here" : `You've posted here ${n} times`;
    case 'reshare':
      return one ? 'You reshared a post from here' : `You've reshared ${n} posts from here`;
    case 'tide':
      return one ? 'You signed up for a tide announced here' : `You've signed up for ${n} tides announced here`;
    case 'bookmark':
      return one ? 'You saved a post from here' : `You've saved ${n} posts from here`;
    case 'vote':
      return one ? 'You voted in a poll here' : `You've voted in ${n} polls here`;
    case 'like':
      return one ? 'You liked a post here' : `You've liked ${n} posts here`;
  }
}

interface ProfileTerm {
  normalized: string;
  /** As the person wrote it, for the reason line. */
  display: string;
  source: 'skill' | 'title' | 'industry';
}

/**
 * Two-letter terms that are subjects rather than words.
 *
 * Anything else that short is dropped: a skill of "Go" would otherwise match
 * every description that says "where to go".
 */
const SHORT_TERMS = new Set(['ai', 'ui', 'ux', 'qa', 'hr', 'ml', 'bi', 'c#', 'r&d']);

/** Words that say nothing about a subject on their own. */
const EMPTY_TERMS = new Set([
  'and', 'the', 'for', 'with', 'from', 'other', 'general', 'none', 'n/a', 'na',
  'senior', 'junior', 'entry', 'level', 'staff', 'head', 'lead', 'intern', 'new',
]);

export function profileTerms(profile: ProfileTerms): ProfileTerm[] {
  const raw: { text: string; source: ProfileTerm['source'] }[] = [
    ...profile.skills.slice(0, 50).map((text) => ({ text, source: 'skill' as const })),
    ...(profile.title ? [{ text: profile.title, source: 'title' as const }] : []),
    ...(profile.industry ? [{ text: profile.industry, source: 'industry' as const }] : []),
  ];

  const seen = new Set<string>();
  const out: ProfileTerm[] = [];
  for (const { text, source } of raw) {
    const display = text.trim().replace(/\s+/g, ' ');
    const normalized = normalize(display);
    if (!normalized || seen.has(normalized)) continue;
    if (normalized.length < 3 && !SHORT_TERMS.has(normalized)) continue;
    if (EMPTY_TERMS.has(normalized)) continue;
    seen.add(normalized);
    out.push({ normalized, display, source });
  }
  return out;
}

/**
 * Lower case, accents off, and anything that is not a letter, digit, `+`, `#`
 * or `&` turned into a single space.
 *
 * The same on both sides, so "Node.js" in a profile finds "node js" in a
 * description, and "C++" stays itself rather than becoming "c".
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9+#&]+/g, ' ')
    .trim();
}

/* --------------------------------- helpers -------------------------------- */

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
