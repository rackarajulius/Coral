import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CandidateJob,
  JobSource,
  ResultCache,
  SearchInput,
  cleanCompanyName,
  domainSpellsName,
  employmentTypeOf,
  fetchJson,
  formatPay,
  isoDate,
  siteDomain,
  workplaceFromText,
  yearlyPay,
} from './types';

/**
 * Every JSearch request is counted against the RapidAPI plan, whose free
 * allowance is small, and every matcher search by anyone made one. Results
 * for the same role and city are reused for an hour: listings don't change
 * that fast, and someone refining their search, or many people looking for
 * the same role, shouldn't each spend a request.
 */
const RESULTS_FOR_MS = 60 * 60_000;
const MAX_CACHED_SEARCHES = 500;
/**
 * How long a search waits for JSearch. Answers often take 8–25s; the search
 * shouldn't wait that long, but the request is paid for either way, so it is
 * not abandoned: it carries on, and its results are cached for the next
 * search of the same role and city. Cutting it off (as an 8s limit did) spent
 * the request and kept nothing.
 */
const DEFAULT_WAIT_MS = 9000;
const REQUEST_TIMEOUT_MS = 45000;

/** Thrown when JSearch is still answering; its results will be cached shortly. */
export class StillAnswering extends Error {}

/** A city search with fewer jobs than this also searches further afield. */
const ENOUGH_IN_CITY = 5;

/**
 * Countries too big for "the whole country" to mean nearby. A thin small town
 * in Texas or Queensland widens to its state first, and to the country only
 * if the state is thin too; elsewhere a thin city widens to the country.
 */
const WIDEN_BY_REGION = new Set(['US', 'CA', 'AU', 'BR', 'IN', 'MX', 'AR', 'RU', 'CN', 'ZA', 'NG', 'DE', 'FR', 'ES', 'IT']);

/**
 * What to ask Google for: the role, or with a local title as well,
 * `Pflegefachkraft OR nurse`. Google takes OR, and quotes keep a two-word
 * title together (`"ingénieur logiciel" OR "software engineer"`), so both
 * languages cost one request. Checked live 2026-10-16: "nurse in Berlin"
 * found mostly English-titled specialist roles; with the German title, the
 * main market.
 */
function searchTerms(query: string, localQuery?: string): string {
  const term = (t: string) => {
    const bare = t.replace(/"/g, '').replace(/\s+/g, ' ').trim();
    return bare.includes(' ') ? `"${bare}"` : bare;
  };
  if (!localQuery?.trim() || searchKey(localQuery) === searchKey(query)) return query;
  return `${term(localQuery)} OR ${term(query)}`;
}

/** "ug" → "Uganda", from Node's own country names; "" for a code it doesn't know. */
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? '';
  } catch {
    return '';
  }
}

/** "ug" → "UG"; undefined for anything that isn't a two-letter code. */
function isoCountry(code: string | undefined): string | undefined {
  return code && /^[a-z]{2}$/i.test(code) ? code.toUpperCase() : undefined;
}

/** The same title at the same employer is one posting, as the matcher counts them. */
function postingOf(job: CandidateJob): string {
  return `${job.title}|${job.company}`.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** "  Software   Engineer " and "software engineer" are the same search. */
function searchKey(...parts: string[]): string {
  return parts.map((p) => p.trim().toLowerCase().replace(/\s+/g, ' ')).join('|');
}

interface JSearchJob {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  employer_logo?: string;
  employer_website?: string;
  job_publisher?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_description?: string;
  job_apply_link?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
  job_salary_period?: string;
  job_posted_at_datetime_utc?: string;
  job_employment_types?: string[];
  job_employment_type?: string;
  job_is_remote?: boolean;
}

/**
 * JSearch (RapidAPI) — aggregates Google for Jobs (Indeed, LinkedIn, Job Bank,
 * employers' own sites…). Broadest single web source. Disabled unless
 * RAPID_API_KEY is set: the account's RapidAPI key, subscribed to JSearch.
 */
@Injectable()
export class JSearchJobSource implements JobSource {
  readonly name = 'jsearch' as const;
  private readonly results = new ResultCache<CandidateJob[]>(RESULTS_FOR_MS, MAX_CACHED_SEARCHES);

  constructor(private readonly config: ConfigService) {}

  private apiKey(): string | undefined {
    return this.config.get<string>('RAPID_API_KEY')?.trim() || undefined;
  }

  isEnabled(): boolean {
    return !!this.apiKey();
  }

  async search({ query, localQuery, location, region, countryCode, currency, waitMs: patience, limit }: SearchInput): Promise<CandidateJob[]> {
    const apiKey = this.apiKey();
    // The chosen city's country (Google for Jobs searches one country at a time).
    const country = countryCode?.toLowerCase() ?? this.config.get<string>('JSEARCH_COUNTRY', 'ca');
    if (!apiKey) return [];

    const ask: Ask = { apiKey, country, terms: searchTerms(query, localQuery), currency };
    // The jobs found so far, kept as they arrive: if a wider search is still
    // running when the wait is up, these are shown meanwhile.
    let soFar: CandidateJob[] | undefined;
    const answer = this.find(ask, location.trim(), region, (jobs) => (soFar = jobs));
    const waitMs = patience ?? (Number(this.config.get<string>('JSEARCH_WAIT_MS')) || DEFAULT_WAIT_MS);
    let timer: NodeJS.Timeout | undefined;
    const late = new Promise<undefined>((done) => {
      timer = setTimeout(() => done(undefined), waitMs);
    });
    try {
      const jobs = (await Promise.race([answer, late])) ?? soFar;
      if (!jobs) throw new StillAnswering(`still answering after ${waitMs}ms; results will be ready next search`);
      return jobs.slice(0, limit);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Jobs in the place asked for, and when a city has few, further afield.
   *
   * Google for Jobs is deep in big markets (Lagos, Nairobi, Johannesburg gave
   * a full ten for "accountant") but thin in smaller cities: "nurse in
   * Kampala" gave three. With so few, the whole country is searched as well —
   * or in a big country, the state or province first. The city's jobs come
   * first. Each wider search is one more request, cached like the first, and
   * made only when what was found so far came up short. If one fails, what
   * was found stands.
   */
  private async find(
    ask: Ask,
    location: string,
    region: string | undefined,
    onProgress: (jobs: CandidateJob[]) => void,
  ): Promise<CandidateJob[]> {
    let jobs = await this.cached(ask, location);
    onProgress(jobs);
    if (!location || jobs.length >= ENOUGH_IN_CITY) return jobs;

    const country = countryName(ask.country);
    const wider = [
      ...(region && WIDEN_BY_REGION.has(ask.country.toUpperCase()) ? [[region, country].filter(Boolean).join(', ')] : []),
      '', // the whole country
    ];
    for (const place of wider) {
      jobs = withoutRepeats(jobs, await this.cached(ask, place).catch(() => [] as CandidateJob[]));
      onProgress(jobs);
      if (jobs.length >= ENOUGH_IN_CITY) break;
    }
    return jobs;
  }

  private cached(ask: Ask, place: string): Promise<CandidateJob[]> {
    return this.results.get(searchKey(ask.country, ask.terms, place), () => this.fetchJobs(ask, place));
  }

  private async fetchJobs({ apiKey, country, terms, currency }: Ask, location: string): Promise<CandidateJob[]> {
    // Without a city, the country is named in the query as well as set as a
    // parameter: "nurse in Uganda", not just "nurse" with country=ug.
    const place = location || countryName(country);
    const q = place ? `${terms} in ${place}` : terms;
    const params = new URLSearchParams({ query: q, country, page: '1', num_pages: '1' });

    // Thrown rather than emptied, as for Adzuna: the service logs it, the page
    // can say the source was unreachable, and a failure is never cached.
    // `/search` was retired on RapidAPI (it answers 404 "Endpoint does not
    // exist"); `/search-v2` returns the same jobs under `data.jobs`.
    const json = (await fetchJson(`https://jsearch.p.rapidapi.com/search-v2?${params.toString()}`, {
      timeoutMs: REQUEST_TIMEOUT_MS,
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
    })) as { data?: JSearchJob[] | { jobs?: JSearchJob[] } };

    const jobs = Array.isArray(json.data) ? json.data : (json.data?.jobs ?? []);
    return jobs.map((j, i) => this.toCandidate(j, i, currency));
  }

  /** `currency`: the searched country's, for pay a listing states without one. */
  private toCandidate(j: JSearchJob, i: number, currency?: string): CandidateJob {
    const payIn = j.job_salary_currency || currency;
    const company = cleanCompanyName(j.employer_name ?? '') || 'Company';
    const site = siteDomain(j.employer_website);
    return {
      id: `jsearch:${j.job_id ?? i}`,
      title: j.job_title ?? 'Role',
      company,
      // The website is trusted for a logo only when it spells the name.
      companyDomain: site && domainSpellsName(company, site) ? site : undefined,
      logoImageUrl: j.employer_logo || undefined,
      publisher: cleanCompanyName(j.job_publisher ?? '') || undefined,
      location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', '),
      // Many listings have no city ("GH" alone), which the location text can't place.
      countryCode: isoCountry(j.job_country),
      description: j.job_description ?? '',
      url: j.job_apply_link,
      salary: formatPay(j.job_min_salary, j.job_max_salary, payIn, j.job_salary_period),
      source: this.name,
      postedAt: isoDate(j.job_posted_at_datetime_utc),
      employmentType: employmentTypeOf(j.job_employment_types?.length ? j.job_employment_types : j.job_employment_type),
      // Google's flag says remote or not; "not remote" may still be hybrid, so only remote is taken.
      workplace: j.job_is_remote ? 'remote' : workplaceFromText(j.job_title),
      yearlyPay: yearlyPay(j.job_min_salary, j.job_max_salary, j.job_salary_period, payIn),
    };
  }
}

/** One search's settings, the same however far it widens. */
interface Ask {
  apiKey: string;
  /** Lower case, as JSearch takes it. */
  country: string;
  /** The role, or the role in two languages: see `searchTerms`. */
  terms: string;
  currency?: string;
}

/**
 * Jobs found so far, then the new ones from a wider search. Searches overlap,
 * and Google sometimes returns the same posting under a new id.
 */
function withoutRepeats(found: CandidateJob[], more: CandidateJob[]): CandidateJob[] {
  const ids = new Set(found.map((j) => j.id));
  const postings = new Set(found.map(postingOf));
  return [...found, ...more.filter((j) => !ids.has(j.id) && !postings.has(postingOf(j)))];
}
