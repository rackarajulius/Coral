/**
 * The part of a job ad that decides whether someone fits: what it asks for.
 *
 * The AI scorer reads about 900 characters of each job, and ads tend to open
 * with the company. Measured 2026-10-16 on a Toronto frontend search: one
 * job scored 95 on its title alone, because its first 800 characters were
 * all about the company and its "8+ years… 5+ years in React" came at
 * character 1,700. So what the job asks for is found (by its heading, an
 * inline "…in the role:", or failing those a cue like "5+ years") and leads,
 * after a short look at the duties.
 */

/** Phrases that open what a job asks for, as a heading line. */
const ASK_PHRASES = [
  'requirements?',
  '(?:minimum |basic |preferred |required )?qualifications?',
  'must[- ]haves?(?: skills)?',
  'who you are',
  'about you',
  "who we(?:'|’)?re looking for",
  "what we(?:'|’)?re looking for",
  "what you(?:'|’)?ll (?:need|bring)",
  'what (?:will )?help(?:s)? you succeed',
  'you may be a good fit if',
  'to be successful',
  'you should have',
  'you have',
  'you bring',
  'skills(?: and| &) experience',
  'your (?:profile|experience|background|skills)',
  'ideal candidate',
  // French, German, Spanish, Italian, Dutch
  'exigences',
  'profil recherch[ée]',
  'votre profil',
  'ce que nous recherchons',
  'anforderungen',
  '(?:ihr|dein) profil',
  'was (?:du|sie) mitbring(?:st|en)',
  'requisitos',
  'perfil',
  'requisiti',
  'vereisten',
  'functie-eisen',
  'wat (?:wij vragen|breng je mee)',
];

/** Phrases that open what the job is, as a heading line. */
const DO_PHRASES = [
  '(?:key |main )?responsibilities',
  "what you(?:'|’)?ll (?:do|be doing)",
  '(?:about )?the role',
  'role summary',
  'your role',
  'in this role',
  'as an? [^\\n]{0,40}you will',
  'you will',
  'key duties',
  'day[- ]to[- ]day',
  'vos missions',
  'missions',
  '(?:ihre|deine) aufgaben',
  'responsabilidades',
  'mansioni',
  'taken',
];

/**
 * Word edges that know accented letters: `\b` doesn't, so "Profil recherché"
 * never matched (é isn't a word character to it).
 */
const WORD_START = '(?<![\\p{L}\\p{N}])';
const WORD_END = '(?![\\p{L}\\p{N}])';

/** A line that starts with one of the phrases and is short enough to be a heading. */
const headingLine = (phrases: string[]) =>
  new RegExp(`^[\\s•*\\-–#>]*(?:${phrases.join('|')})${WORD_END}[^\\n]{0,50}$`, 'imu');

/**
 * The same, written into running text, as ads with no line breaks do: only
 * the phrases unlikely in ordinary sentences, and only followed by a colon.
 */
const inlineHeading = (phrases: string[]) =>
  new RegExp(`${WORD_START}(?:${phrases.join('|')})${WORD_END}[^.:\\n]{0,30}:`, 'iu');

const ASK_LINE = headingLine(ASK_PHRASES);
const DO_LINE = headingLine(DO_PHRASES);
const ASK_INLINE = inlineHeading([
  'requirements?',
  'qualifications?',
  'must[- ]haves?',
  'who you are',
  "what we(?:'|’)?re looking for",
  "what you(?:'|’)?ll (?:need|bring)",
  'help(?:s)? you succeed',
  'you may be a good fit if',
  'to be successful',
  'ideal candidate',
  'exigences',
  'profil recherch[ée]',
  'anforderungen',
  'requisitos',
]);
const DO_INLINE = inlineHeading(['responsibilities', "what you(?:'|’)?ll (?:do|be doing)", 'key duties']);

/** Failing a heading, the first thing that reads like a requirement. */
const REQUIREMENT_CUE =
  /\b\d{1,2}\s*\+?\s*(?:years?|yrs|ans|jahre|años|anni|jaar)\b|\b(?:experience (?:with|in)|proficien(?:t|cy) (?:in|with)|degree in|must have)\b/i;

const flat = (s: string) => s.replace(/\s+/g, ' ').trim();

function startOf(text: string, pattern: RegExp): number | undefined {
  const at = text.search(pattern);
  return at < 0 ? undefined : at;
}

/** Where a requirement cue's sentence begins: back to the last full stop, colon or line break. */
function cueAt(text: string): number | undefined {
  const at = startOf(text, REQUIREMENT_CUE);
  if (at === undefined) return undefined;
  const before = text.slice(Math.max(0, at - 150), at);
  const stop = Math.max(before.lastIndexOf('. '), before.lastIndexOf(':'), before.lastIndexOf('\n'));
  return stop < 0 ? at : at - before.length + stop + 1;
}

export function jobDigest(description: string | null | undefined, max = 900): string {
  const text = (description ?? '').replace(/\r/g, '');
  if (flat(text).length <= max) return flat(text);

  const asks = startOf(text, ASK_LINE) ?? startOf(text, ASK_INLINE) ?? cueAt(text);
  const does = startOf(text, DO_LINE) ?? startOf(text, DO_INLINE);
  if (asks === undefined) return flat(text.slice(does ?? 0)).slice(0, max).trim();

  // The duties briefly, when they come first; then what the job asks for.
  const duties = does !== undefined && does < asks ? flat(text.slice(does, asks)).slice(0, Math.round(max * 0.35)).trim() : '';
  const needs = flat(text.slice(asks)).slice(0, max - (duties ? duties.length + 3 : 0)).trim();
  return duties ? `${duties} … ${needs}` : needs;
}
