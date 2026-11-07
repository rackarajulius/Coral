/**
 * A job ad's plain text, laid out for reading.
 *
 * Sources send ads as text with line breaks (JSearch, Ashby, and Greenhouse and
 * Lever once the server has turned their HTML into lines). Headings, bullets
 * and paragraphs are told apart from the lines alone. A guess is never worse
 * than the raw text: a misread line shows as a bold heading or a plain
 * paragraph, and nothing is dropped.
 */

export type JobTextBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; lines: string[] }
  | { kind: "list"; ordered: boolean; items: string[] };

/** "• ", "- ", "* ", "1. ", "2) "… at the start of a line. */
const BULLET = /^(?:[•●▪◦·*–—-]|(\d{1,2})[.)])\s+/;
/** A marker alone on its line, its text on the next. */
const LONE_BULLET = /^(?:[•●▪◦·*–—-]|\d{1,2}[.)])$/;

/**
 * A heading's text, or null when the line reads as prose.
 *
 * "What You'll Do:" and "AS AN ENGINEER ON THE TEAM, YOU WILL:" end in a
 * colon. "Who are we?" and "About the Role" stand on their own line, short and
 * without a sentence's ending. A colon inside the line ("Pay: $20 an hour") is
 * a detail, and a next line in lower case continues a sentence.
 */
function headingText(line: string, standsApart: boolean, next: string): string | null {
  if (line.length > 100) return null;
  if (line.endsWith(":")) return line.slice(0, -1).trim() || null;
  if (!standsApart || line.length > 60 || line.includes(":") || /^\p{Ll}/u.test(next)) return null;
  if (line.split(/\s+/).length > 8 || /[.!,;]$/.test(line)) return null;
  return /^[\p{Lu}\p{N}]/u.test(line) ? line : null;
}

/** "Do X • Do Y • Do Z" written on one line, as some ads arrive, becomes a line each. */
function splitInlineBullets(line: string): string[] {
  const parts = line.split(/\s+•\s+/);
  return parts.length > 2 ? [parts[0], ...parts.slice(1).map((p) => `• ${p}`)] : [line];
}

export function jobTextBlocks(text: string | undefined): JobTextBlock[] {
  const lines = (text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .flatMap(splitInlineBullets);

  const blocks: JobTextBlock[] = [];
  let paragraph: string[] | null = null;
  let list: { ordered: boolean; items: string[] } | null = null;
  let afterBlank = true;
  let pendingBullet = false;

  const close = () => {
    if (paragraph) blocks.push({ kind: "paragraph", lines: paragraph });
    if (list) blocks.push({ kind: "list", ...list });
    paragraph = null;
    list = null;
  };
  const addItem = (item: string, ordered: boolean) => {
    if (paragraph) {
      blocks.push({ kind: "paragraph", lines: paragraph });
      paragraph = null;
    }
    if (list && list.ordered !== ordered) close();
    if (!list) list = { ordered, items: [] };
    list.items.push(item);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      // A blank line ends a paragraph, but not a list: Ashby leaves one between bullets.
      if (paragraph) {
        blocks.push({ kind: "paragraph", lines: paragraph });
        paragraph = null;
      }
      afterBlank = true;
      continue;
    }

    const standsApart = afterBlank;
    afterBlank = false;

    if (LONE_BULLET.test(line)) {
      pendingBullet = true;
      continue;
    }
    const bullet = line.match(BULLET);
    if (pendingBullet || bullet) {
      addItem(bullet ? line.slice(bullet[0].length) : line, !pendingBullet && !!bullet?.[1]);
      pendingBullet = false;
      continue;
    }

    const next = lines.slice(i + 1).find(Boolean);
    const heading = next ? headingText(line, standsApart, next) : null;
    if (heading) {
      close();
      blocks.push({ kind: "heading", text: heading });
      continue;
    }

    if (list) close();
    (paragraph ??= []).push(line);
  }
  close();
  return blocks;
}
