/**
 * What Nova calls the candidate.
 *
 * One short name, chosen by the candidate — prefilled with the first word of
 * their first name, and freely changed to a nickname or a spelling that says
 * the name the way it sounds. Deliberately not guessed at: deciding for someone
 * which names are "hard to pronounce" is a judgement about their name, and the
 * person who owns it is the only one who should make it.
 *
 * The name is spoken and shown in the greeting only. It is never sent to the
 * model that writes questions or grades answers.
 */

export const CALL_NAME_MAX = 30;

/** Letters (any script), marks, spaces, hyphens, apostrophes and full stops. */
export function sanitizeCallName(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\s'’.-]/gu, "")
    .replace(/\s+/g, " ")
    .slice(0, CALL_NAME_MAX);
}

/**
 * The first word of the first name, or nothing.
 *
 * The display name is used only when it looks like a real full name — it
 * falls back to the email's local part, and greeting someone as
 * "jsmith1987" is worse than not using a name at all.
 */
export function defaultCallName(user: { firstName?: string | null; displayName?: string | null } | null): string {
  const first = user?.firstName?.trim();
  if (first) return sanitizeCallName(first.split(/\s+/)[0]).trim();
  const display = user?.displayName?.trim();
  if (display && /\s/.test(display) && !display.includes("@")) {
    return sanitizeCallName(display.split(/\s+/)[0]).trim();
  }
  return "";
}

/** "Hi Bob" or plain "Hi" — the opening every greeting starts with. */
export function salutation(callName?: string): string {
  const name = callName ? sanitizeCallName(callName).trim() : "";
  return name ? `Hi ${name}` : "Hi";
}
