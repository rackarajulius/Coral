/**
 * @mentions as the community stores them, and as people type them.
 *
 * Saved text carries each mention as `@[Name](person:<id>)` or
 * `@[Name](company:<page id>)`: the id says who is meant, the name is what
 * readers see. Nobody should have to look at that while writing, so the
 * composer and comment box hold the words as they read — "@Ada Lovelace" —
 * plus the list of people picked from the "@" menu, and turn one into the
 * other only when sending (`toStored`) or opening for an edit (`toDisplay`).
 *
 * The server checks every mention and puts each one's own name in, so
 * nothing here is trusted beyond being convenient.
 */

export type MentionKind = "person" | "company";

/** Someone picked from the "@" menu. */
export interface Mention {
  kind: MentionKind;
  id: string;
  name: string;
}

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

/** One stored mention, as a regex source: groups are the name, the kind and the id. */
export const MENTION_SOURCE = `@\\[([^\\[\\]\\n]{1,120})\\]\\((person|company):(${UUID})\\)`;

const tokens = () => new RegExp(MENTION_SOURCE, "g");

/** Saved text as plain words, each mention as "@Name": for previews and anywhere links can't go. */
export function plainText(stored: string | null | undefined): string {
  return (stored ?? "").replace(tokens(), (_whole, name: string) => `@${name}`);
}

/** Saved text as it reads, for editing, with the mentions it had. */
export function toDisplay(stored: string | null | undefined): { text: string; mentions: Mention[] } {
  const mentions: Mention[] = [];
  const text = (stored ?? "").replace(tokens(), (_whole, name: string, kind: MentionKind, id: string) => {
    if (!mentions.some((m) => m.kind === kind && m.id === id)) mentions.push({ kind, id, name });
    return `@${name}`;
  });
  return { text, mentions };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The words as typed, with every "@Name" that is still whole turned back into
 * a mention of the person picked for it.
 *
 * One that was edited — a letter taken out, the name half deleted — no longer
 * matches and stays as ordinary words, which is what someone who changed it
 * would expect. Longer names go first, so "@Ada Lovelace" is not taken for
 * "@Ada" followed by "Lovelace".
 */
export function toStored(text: string, mentions: Mention[]): string {
  let out = text;
  const byLength = [...mentions].sort((a, b) => b.name.length - a.name.length);
  for (const m of byLength) {
    const name = m.name.replace(/[[\]\n\r]+/g, " ").trim();
    if (!name) continue;
    const whole = new RegExp(`@${escape(name)}(?![\\p{L}\\p{N}_])`, "gu");
    out = out.replace(whole, `@[${name}](${m.kind}:${m.id})`);
  }
  return out;
}

/**
 * What is being typed after an "@" just before the caret, if anything.
 *
 * A first name and a second word are allowed, so "@ada lo" can narrow to Ada
 * Lovelace; an email address is not a mention, so the @ has to start a word.
 */
export function mentionQueryAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const match = /(?:^|[\s(])@([\p{L}\p{N}_.'’-]{1,30}(?: [\p{L}\p{N}_.'’-]{0,30})?)$/u.exec(before);
  if (!match) return null;
  return { start: caret - match[1].length - 1, query: match[1] };
}
