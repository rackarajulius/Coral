import { cityOf } from '../../locations/place-text';

export type JobSourceName = 'platform' | 'adzuna' | 'jsearch' | 'talent' | 'greenhouse' | 'lever' | 'ashby';

/** Query terms for keyword filtering (words longer than 2 chars, capped). */
export function queryTerms(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2)
    .slice(0, 6);
}

/** "some-company_inc" -> "Some Company Inc" — used to label ATS board tokens. */
export function titleCase(token: string): string {
  return token.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

/* ----------------------------- company names ----------------------------- */

/** Legal-form words that differ between listings of the same company. */
const LEGAL_FORMS = /\b(inc|incorporated|ltd|limited|llc|llp|corp|corporation|co|company|plc|ulc|gmbh)\b/g;

/**
 * Screen-reader text that job sites attach to employer links, which comes
 * through as part of the name: JSearch gave "Vector Institute   This link
 * will open in a new window".
 */
const LINK_HINTS = /\(?\s*\b(?:this\s+link\s+)?(?:will\s+)?opens?\s+in\s+(?:a\s+)?new\s+(?:window|tab)\b\.?\s*\)?/gi;

/** An employer name as people would write it, without what sites attach to it. */
export function cleanCompanyName(name: string): string {
  return name
    .replace(LINK_HINTS, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—|·,:]+|[\s\-–—|·,:]+$/g, '')
    .trim();
}

/** "Rush Street Interactive, Inc." → "rush street interactive". Empty for placeholders. */
export function normalizeName(name: string): string {
  const n = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(LEGAL_FORMS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Adzuna says "Company" when it doesn't know; that is nobody's name.
  return n.length < 2 || n === 'company' || n === 'confidential' ? '' : n;
}

/**
 * Whether a website spells the company's name: forma.ai for "Forma.ai",
 * opentable.com for "OpenTable", identity.digital for "Identity Digital".
 * A website a listing merely mentions can belong to someone else — JSearch
 * gave DoorDash Canada's as a campaign site, doordashcanada.publicfirst.co.
 */
export function domainSpellsName(company: string, domain: string): boolean {
  const compact = normalizeName(company).replace(/ /g, '');
  if (!compact) return false;
  const site = domain.toLowerCase();
  return compact === site.replace(/[^a-z0-9]/g, '') || compact === site.replace(/\.[a-z]+$/, '').replace(/[^a-z0-9]/g, '');
}

/**
 * Whether a search candidate is the company on the listing: the same name
 * once legal forms are set aside ("OpenTable Inc." / "OpenTable"), or a
 * website that spells the name. A shared first word is not enough: "OSI
 * Maritime Systems" is not OSI Systems.
 */
export function sameCompany(company: string, candidateName: string, candidateDomain: string): boolean {
  const ours = normalizeName(company);
  if (!ours) return false;
  return ours === normalizeName(candidateName) || domainSpellsName(company, candidateDomain);
}

/** "https://www.Randstad.com/careers" → "randstad.com"; undefined if not a web address. */
export function siteDomain(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
  if (hasScheme && !/^https?:\/\//i.test(url)) return undefined;
  try {
    const host = new URL(hasScheme ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '');
    return host.includes('.') ? host : undefined;
  } catch {
    return undefined;
  }
}

/** One employer's public job board on an ATS. */
export interface EmployerBoard {
  /** The ATS's handle for the board, as it appears in the board's URL. */
  token: string;
  /** The employer's name as people know it. */
  company: string;
  /** The employer's website, e.g. "wealthsimple.com". Lets the card show a logo. */
  domain?: string;
}

/** Most boards read per source; each is a separate request on every search. */
const MAX_BOARDS = 8;

const DOMAIN = /^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/;

/**
 * Reads a board list setting: "token", "token:Company Name" or
 * "token:Company Name:company.com", comma-separated.
 *
 * The name is optional because handles are often not the name: "neofinancial"
 * is Neo Financial and "getmaple" is Maple. Matches show it, and company
 * research searches the web for it, so a slug made into words was not enough.
 * The website is optional too; without one the card shows a letter, not a logo.
 */
export function parseBoards(raw: string | undefined): EmployerBoard[] {
  return (raw || '')
    .split(',')
    .map((entry) => {
      const [token = '', name = '', site = ''] = entry.split(':').map((part) => part.trim());
      const domain = site.toLowerCase();
      return {
        token,
        company: name || titleCase(token),
        ...(DOMAIN.test(domain) ? { domain } : {}),
      };
    })
    .filter((b) => b.token)
    .slice(0, MAX_BOARDS);
}

/**
 * Orders a board's jobs by how well they fit the search, dropping those that
 * don't fit at all.
 *
 * A job used to count as a match when any search word appeared anywhere in
 * it, and boards were read in posting order, so "Senior Frontend Engineer"
 * returned whatever was posted first and said "senior" somewhere in several
 * thousand words of description. A word in the title now counts for three in
 * the description, so a frontend role outranks a senior recruiter.
 *
 * With a city chosen, a job there comes before an equal fit elsewhere. It is
 * a preference, not a filter: boards list "Remote (Canada)" and multi-office
 * roles that a strict match on the city would wrongly drop.
 */
export function rankByTerms(jobs: CandidateJob[], terms: string[], city = ''): CandidateJob[] {
  const place = city.trim().toLowerCase();
  return jobs
    .map((job) => {
      const title = job.title.toLowerCase();
      const body = `${job.location} ${job.description}`.toLowerCase();
      const fit = terms.length === 0 ? 1 : terms.reduce((n, t) => n + (title.includes(t) ? 3 : body.includes(t) ? 1 : 0), 0);
      const here = place && fit > 0 && job.location.toLowerCase().includes(place) ? 2 : 0;
      return { job, fit, score: fit + here };
    })
    .filter((r) => r.fit > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.job);
}

/**
 * Searches every configured board and takes from each in turn.
 *
 * Boards were concatenated and then cut to the limit, so with eight boards the
 * last few never appeared at all. Taking in turn gives each board its best
 * fits first. A board that fails is skipped; only if every one fails does the
 * source fail, so the page can say it could not be reached rather than that
 * nothing matched.
 */
export async function searchBoards(
  label: string,
  boards: EmployerBoard[],
  fetchBoard: (board: EmployerBoard) => Promise<CandidateJob[]>,
  query: string,
  limit: number,
  warn: (message: string) => void,
  location = '',
): Promise<CandidateJob[]> {
  const settled = await Promise.allSettled(boards.map(fetchBoard));
  settled.forEach((r, i) => {
    if (r.status === 'rejected') {
      warn(`${label} board "${boards[i].token}" failed: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
    }
  });
  if (settled.length > 0 && settled.every((r) => r.status === 'rejected')) {
    throw new Error(`every ${label} board failed`);
  }

  const terms = queryTerms(query);
  const ranked = settled.map((r) => (r.status === 'fulfilled' ? rankByTerms(r.value, terms, cityOf(location)) : []));
  const out: CandidateJob[] = [];
  for (let i = 0; out.length < limit && ranked.some((jobs) => i < jobs.length); i++) {
    for (const jobs of ranked) {
      if (i < jobs.length && out.length < limit) out.push(jobs[i]);
    }
  }
  return out;
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
  /** The job's country (ISO 3166, upper case), when the source states it rather than leaving it to `location`. */
  countryCode?: string;
  description: string; // used for scoring (may be truncated)
  url?: string; // apply / detail link
  salary?: string;
  source: JobSourceName;
  /** A logo the source already has (Coral's own jobs). */
  logoUrl?: string;
  /** The employer's website, when known, for looking up a logo. */
  companyDomain?: string;
  /** An image of the employer's logo elsewhere, to be copied (JSearch). */
  logoImageUrl?: string;
  /** Where the listing was published, when the source says: "LinkedIn", "Job Bank"… */
  publisher?: string;
  /** When it was posted (ISO), when the source says. */
  postedAt?: string;
  employmentType?: EmploymentType;
  /** Only when the source says; unknown is left out rather than guessed. */
  workplace?: Workplace;
  /** Pay as a yearly range, for sorting and filtering; `salary` is what is shown. */
  yearlyPay?: YearlyPay;
}

/* ------------------------- job details, normalized ------------------------ */

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'temporary' | 'internship';
export type Workplace = 'remote' | 'hybrid' | 'onsite';
export interface YearlyPay {
  min?: number;
  max?: number;
  currency?: string;
}

/**
 * Each source words these differently: "FULLTIME", "Full-time permanent",
 * "FullTime", "full_time", "Intern". Anything unrecognised is left unknown.
 */
export function employmentTypeOf(raw: string | string[] | null | undefined): EmploymentType | undefined {
  const text = (Array.isArray(raw) ? raw.join(' ') : raw ?? '').toLowerCase().replace(/[^a-z]+/g, '');
  if (!text) return undefined;
  if (text.includes('intern')) return 'internship';
  if (text.includes('parttime')) return 'part_time';
  if (text.includes('fulltime') || text === 'permanent') return 'full_time';
  if (text.includes('contract') || text.includes('freelance')) return 'contract';
  if (text.includes('temp') || text.includes('seasonal')) return 'temporary';
  return undefined;
}

/** "OnSite", "on-site", "in office", "Hybrid", "remote". Anything else is unknown. */
export function workplaceOf(raw: string | null | undefined): Workplace | undefined {
  const text = (raw ?? '').toLowerCase().replace(/[^a-z]+/g, '');
  if (!text) return undefined;
  if (text.includes('hybrid')) return 'hybrid';
  if (text.includes('remote')) return 'remote';
  if (text === 'onsite' || text.includes('inoffice') || text.includes('inperson')) return 'onsite';
  return undefined;
}

/**
 * From free text such as a location, only when it says so outright:
 * "Remote (Canada)", "Toronto (Hybrid)". Silence is not "on-site".
 */
export function workplaceFromText(text: string | null | undefined): Workplace | undefined {
  if (!text) return undefined;
  if (/\bhybrid\b/i.test(text)) return 'hybrid';
  if (/\bremote\b/i.test(text)) return 'remote';
  return undefined;
}

const PERIODS_PER_YEAR: Array<[RegExp, number]> = [
  [/hour/, 2080],
  [/day|daily/, 260],
  [/week/, 52],
  [/month/, 12],
  [/year|annual|yr/, 1],
];

/** A pay range turned yearly ("$25 per hour" → 52,000), or undefined without a number. */
export function yearlyPay(
  min: number | null | undefined,
  max: number | null | undefined,
  period: string | null | undefined,
  currency?: string | null,
): YearlyPay | undefined {
  const lo = typeof min === 'number' && min > 0 ? min : undefined;
  const hi = typeof max === 'number' && max > 0 ? max : undefined;
  if (lo === undefined && hi === undefined) return undefined;
  const p = (period ?? 'year').toLowerCase();
  const factor = PERIODS_PER_YEAR.find(([re]) => re.test(p))?.[1] ?? 1;
  return {
    ...(lo !== undefined ? { min: Math.round(lo * factor) } : {}),
    ...(hi !== undefined ? { max: Math.round(hi * factor) } : {}),
    ...(currency ? { currency: currency.toUpperCase() } : {}),
  };
}

/** An ISO date from a date string or epoch milliseconds, or undefined if unreadable. */
export function isoDate(value: string | number | Date | null | undefined): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export interface SearchInput {
  query: string; // role + keywords
  location: string; // city/region; '' = anywhere
  /** The location's country (ISO 3166, upper case), when known. Sources that search by country use it. */
  countryCode?: string;
  /**
   * The role as job ads in the searched place's language write it, when that
   * isn't English ("Pflegefachkraft" for nurse in Germany). Keyword searches
   * look for both.
   */
  localQuery?: string;
  /** The searched city's province or state ("Saskatchewan"), when the city is known. */
  region?: string;
  /** The searched country's currency (ISO 4217), for pay a listing states without one. */
  currency?: string;
  /**
   * How long a slow source may keep the search waiting. A person's search
   * keeps each source's own short wait; a background check passes longer.
   */
  waitMs?: number;
  limit: number;
}

/** How each currency is usually written before an amount. */
const CURRENCY_SIGNS: Record<string, string> = {
  CAD: 'C$', USD: 'US$', GBP: '£', EUR: '€', AUD: 'A$', NZD: 'NZ$', SGD: 'S$', INR: '₹', JPY: '¥',
};

const PER_PERIOD: Array<[RegExp, string]> = [
  [/hour/i, '/hr'],
  [/day/i, '/day'],
  [/week/i, '/wk'],
  [/month/i, '/mo'],
];

/**
 * Pay as a card shows it: "€45k–€60k", "US$25–US$30/hr", "UGX 2,500k". No
 * currency sign when none is known, rather than a guessed one: JSearch used to
 * label every unmarked salary CAD, wherever the job was.
 */
export function formatPay(
  min: number | null | undefined,
  max: number | null | undefined,
  currency?: string | null,
  period?: string | null,
): string | undefined {
  const lo = typeof min === 'number' && min > 0 ? min : undefined;
  const hi = typeof max === 'number' && max > 0 ? max : undefined;
  if (lo === undefined && hi === undefined) return undefined;
  const code = currency?.toUpperCase();
  const sign = code ? (CURRENCY_SIGNS[code] ?? `${code} `) : '';
  const amount = (n: number) => `${sign}${n >= 1000 ? `${Math.round(n / 1000).toLocaleString('en')}k` : Math.round(n)}`;
  const per = PER_PERIOD.find(([re]) => re.test(period ?? ''))?.[1] ?? '';
  const range = lo !== undefined && hi !== undefined && lo !== hi ? `${amount(lo)}–${amount(hi)}` : amount((lo ?? hi) as number);
  return `${range}${per}`;
}

/** Re-exported: sources read the city out of a location label. */
export { cityOf };

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

/**
 * Answers kept for a while, shared by every search on this server.
 *
 * Searches arriving together share one request. A failure is not kept, so
 * the next search tries again rather than inheriting it. The oldest entry
 * goes once `max` is reached.
 */
export class ResultCache<T> {
  private readonly entries = new Map<string, { at: number; value: Promise<T> }>();

  constructor(
    private readonly ttlMs: number,
    private readonly max: number,
  ) {}

  get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value;

    const value = load();
    this.entries.delete(key);
    this.entries.set(key, { at: Date.now(), value });
    value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });
    if (this.entries.size > this.max) {
      this.entries.delete(this.entries.keys().next().value as string);
    }
    return value;
  }
}

/**
 * Every search read every configured board in full, descriptions included:
 * over a megabyte for some employers, eight boards per source, on each
 * search. Board listings change over days, so ten minutes old is current
 * enough.
 */
const boardCache = new ResultCache<unknown>(10 * 60_000, 64);

/** fetchJson for public job boards, kept for ten minutes. */
export function cachedBoardJson(url: string, timeoutMs = 8000): Promise<unknown> {
  return boardCache.get(url, () => fetchJson(url, { timeoutMs }));
}
