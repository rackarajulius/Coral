import { useEffect } from 'react';

/**
 * What the tab says when no page has anything more specific to say.
 * Keep in step with the <title> in index.html — a static file can't import this.
 */
export const DEFAULT_TITLE = 'Coral - Hiring & Talent Platform';

const BRAND = 'Coral';

/**
 * Longest descriptive part we'll put in the tab.
 *
 * The tab itself truncates far shorter than this, but the same string is what
 * lands in history and in a bookmark, and an employer's "Senior Full Stack
 * Engineer — React/Node — Remote — Contract to Hire" is unreadable there.
 */
const MAX_LENGTH = 60;

function tidy(value: string): string {
  // Job titles are employer-supplied, so they arrive with stray newlines and
  // runs of spaces that would show up verbatim in the tab.
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed.length > MAX_LENGTH ? `${collapsed.slice(0, MAX_LENGTH - 1).trimEnd()}…` : collapsed;
}

/**
 * Keeps the browser tab in step with what the page is showing.
 *
 * Pass what the page is about — "Senior Engineer at Acme" — and the brand is
 * appended. Pass nothing (or null while data is still loading) and the tab
 * falls back to {@link DEFAULT_TITLE}.
 *
 * The most distinguishing words go first on purpose: a tab shows perhaps twenty
 * characters, so "Senior Engineer at Acme | Coral" reads as "Senior Engi…" and
 * still tells someone with eight job tabs open which one this is.
 */
export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    const trimmed = title ? tidy(title) : '';
    document.title = trimmed ? `${trimmed} | ${BRAND}` : DEFAULT_TITLE;
  }, [title]);

  // Restoring belongs on unmount alone. Doing it in the effect above would
  // blink the default title between two selections on the same page.
  useEffect(() => () => { document.title = DEFAULT_TITLE; }, []);
}

export default useDocumentTitle;
