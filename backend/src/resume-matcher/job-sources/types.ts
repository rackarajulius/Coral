export type JobSourceName = 'platform' | 'adzuna' | 'jsearch' | 'talent' | 'greenhouse' | 'lever';

/** Query terms for keyword filtering (words longer than 2 chars, capped). */
export function queryTerms(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2)
    .slice(0, 6);
}

export function matchesTerms(text: string, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const hay = text.toLowerCase();
  return terms.some((t) => hay.includes(t));
}

/** "some-company_inc" -> "Some Company Inc" — used to label ATS board tokens. */
export function titleCase(token: string): string {
  return token.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

/** Decode common entities and strip tags from ATS HTML (e.g. Greenhouse content). */
export function stripHtml(html: string): string {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A normalized job candidate from any source, ready for AI scoring. */
export interface CandidateJob {
  id: string; // globally unique (source-prefixed)
  title: string;
  company: string;
  location: string;
  description: string; // used for scoring (may be truncated)
  url?: string; // apply / detail link
  salary?: string;
  source: JobSourceName;
}

export interface SearchInput {
  query: string; // role + keywords
  location: string; // city/region; '' = anywhere
  limit: number;
}

export interface JobSource {
  readonly name: JobSourceName;
  /** Whether this source is configured (e.g. API key present). Disabled sources are skipped. */
  isEnabled(): boolean;
  search(input: SearchInput): Promise<CandidateJob[]>;
}

/** fetch with a hard timeout so a slow source can't stall the whole run. */
export async function fetchJson(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<unknown> {
  const { timeoutMs = 8000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
