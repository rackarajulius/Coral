/**
 * A small boolean grammar for candidate search.
 *
 * Deliberately not a full query language. Recruiters write things like
 * `"product manager" fintech OR payments -agency`, and the useful shape of that
 * is three buckets: terms that must appear, groups where any one will do, and
 * terms that must not appear. A parser that handled parentheses and precedence
 * would answer questions nobody is asking and fail in ways nobody could debug
 * from a search box.
 *
 * Rules:
 *  - `"two words"` is one phrase.
 *  - `A OR B` puts A and B in one group; any of them satisfies it. `A OR B OR C`
 *    is one group of three.
 *  - `-term` or `NOT term` excludes.
 *  - everything else must appear.
 *
 * `AND` is accepted and ignored, because people type it and it is already the
 * default — silently treating it as a search term would quietly break the query.
 *
 * **Sentences are not conjunctions.** The hiring assistant's box invites a
 * brief — "Senior frontend engineer with React and strong system design" — and
 * requiring every word of that finds nobody, because "with" and "strong" are
 * not on anyone's profile. So a query that uses no operator at all is read
 * loosely: its terms become one OR group, a net to be ranked rather than a set
 * of conditions. The moment an operator appears, the recruiter is being
 * explicit and every rule above is honoured exactly.
 */
export interface ParsedQuery {
  /** Every one of these must match. */
  all: string[];
  /** Each group needs at least one match. */
  any: string[][];
  /** None of these may match. */
  none: string[];
  /** True when no operator was used, so the terms were read as one OR group. */
  loose: boolean;
}

/** Most terms we will honour. Beyond this the query is noise, not precision. */
const MAX_TERMS = 24;

/**
 * Dropped from a loose query.
 *
 * Only words that carry no meaning on a profile. `contains` matching makes
 * these worse than useless: "in" matches "Ruby on Rails" and "Design", so
 * leaving them in would score nearly everyone as a partial match.
 */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'for', 'from',
  'has', 'have', 'in', 'into', 'is', 'it', 'of', 'on', 'or', 'our', 'should',
  'strong', 'that', 'the', 'their', 'them', 'they', 'this', 'to', 'up', 'was',
  'we', 'who', 'will', 'with', 'years', 'yrs', 'experience', 'someone', 'looking',
]);

/** Splits on whitespace but keeps "quoted phrases" together. */
function tokenize(query: string): string[] {
  const out: string[] = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(query)) !== null) {
    const token = (m[1] ?? m[2] ?? '').trim();
    if (token) out.push(token);
  }
  return out;
}

/**
 * True when the recruiter used the grammar rather than just typing.
 *
 * Checked on the raw text, before tokenizing, so a quoted phrase still counts
 * as an operator even though tokenizing removes its quotes.
 *
 * The keywords count **only in capitals**, because that is the difference
 * between writing a query and writing a sentence. "React and Node" and
 * "designer or illustrator" are things people say; `React AND Node` is an
 * instruction. Accepting the lower-case forms here would turn every brief
 * containing the word "and" into a strict conjunction and return nobody —
 * which is the failure this whole loose/strict split exists to prevent.
 *
 * Once strict, the parser below is case-insensitive: the recruiter has already
 * shown they are writing a query, and failing them over a lower-case `or`
 * halfway through would be pedantry.
 */
const OPERATORS = new Set(['AND', 'OR', 'NOT']);

function usesOperators(query: string, tokens: string[]): boolean {
  if (query.includes('"')) return true;
  return tokens.some((t) => OPERATORS.has(t) || (t.startsWith('-') && t.length > 1));
}

export function parseQuery(query: string): ParsedQuery {
  const all: string[] = [];
  const any: string[][] = [];
  const none: string[] = [];

  const tokens = tokenize(query || '').slice(0, MAX_TERMS * 2);
  const loose = !usesOperators(query || '', tokens);

  if (loose) {
    // One OR group: a net wide enough to catch the brief, which the AI ranker
    // then orders. Terms too short to mean anything are dropped for the same
    // reason as the stopwords.
    const terms = dedupe(
      tokens
        .map((t) => clean(t))
        .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
    ).slice(0, MAX_TERMS);
    return { all: [], any: terms.length ? [terms] : [], none: [], loose: true };
  }

  let negateNext = false;
  // The group the last OR built, so the next OR extends it. Without this the
  // third term of `a OR b OR c` reaches back for whatever required term came
  // before the chain and starts a second group with it.
  let chain: string[] | null = null;
  // Whether the last token was a required term: the only thing an OR can join.
  let joinable = false;

  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i];
    const upper = raw.toUpperCase();

    if (upper === 'OR') {
      // Joins what came before to what comes next. A leading or trailing OR is
      // someone mid-sentence, not an instruction, and so is one with only an
      // exclusion before it: it is ignored, and what follows is read as an
      // ordinary term.
      const next = tokens[i + 1];
      if (!next || next.toUpperCase() === 'OR') continue;
      if (chain) {
        chain.push(clean(next));
      } else if (joinable) {
        chain = [all.pop() as string, clean(next)];
        any.push(chain);
      } else {
        continue;
      }
      i += 1;
      continue;
    }

    // Anything but OR ends a chain.
    chain = null;
    joinable = false;

    if (upper === 'AND') continue;
    if (upper === 'NOT') {
      negateNext = true;
      continue;
    }

    let term = raw;
    let negated = negateNext;
    negateNext = false;
    if (term.startsWith('-') && term.length > 1) {
      negated = true;
      term = term.slice(1);
    }

    const value = clean(term);
    if (!value) continue;
    if (negated) {
      none.push(value);
    } else {
      all.push(value);
      joinable = true;
    }
  }

  return {
    all: dedupe(all).slice(0, MAX_TERMS),
    any: any.map((g) => dedupe(g)).filter((g) => g.length > 1).slice(0, MAX_TERMS),
    none: dedupe(none).slice(0, MAX_TERMS),
    loose: false,
  };
}

/** True when the query asked for nothing at all. */
export function isEmptyQuery(p: ParsedQuery): boolean {
  return p.all.length === 0 && p.any.length === 0 && p.none.length === 0;
}

function clean(term: string): string {
  return term.replace(/^[-"']+|["']+$/g, '').trim().toLowerCase();
}

function dedupe(list: string[]): string[] {
  return [...new Set(list.filter(Boolean))];
}
