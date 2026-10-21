import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CandidateJob,
  JobSource,
  SearchInput,
  cleanCompanyName,
  employmentTypeOf,
  fetchJson,
  formatPay,
  isoDate,
  workplaceFromText,
  yearlyPay,
} from './types';

interface AdzunaResult {
  id?: string;
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description?: string;
  redirect_url?: string;
  salary_min?: number;
  salary_max?: number;
  /** "1" when Adzuna estimated the salary rather than the employer stating it. */
  salary_is_predicted?: string;
  created?: string;
  contract_time?: string;
  contract_type?: string;
}

/**
 * Adzuna job-search API (Canada by default). Structured, ToS-friendly.
 * Disabled unless ADZUNA_APP_ID + ADZUNA_APP_KEY are configured.
 */
@Injectable()
export class AdzunaJobSource implements JobSource {
  readonly name = 'adzuna' as const;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return !!this.config.get<string>('ADZUNA_APP_ID') && !!this.config.get<string>('ADZUNA_APP_KEY');
  }

  async search({ query, localQuery, location, countryCode, limit }: SearchInput): Promise<CandidateJob[]> {
    const appId = this.config.get<string>('ADZUNA_APP_ID');
    const appKey = this.config.get<string>('ADZUNA_APP_KEY');
    if (!appId || !appKey) return [];
    // The chosen city's country when there is one. Adzuna covers 19
    // countries; for a city elsewhere (Kampala, Nairobi) it has nothing to
    // offer, rather than Canadian jobs.
    const country = countryCode?.toLowerCase() ?? this.config.get<string>('ADZUNA_COUNTRY', 'ca');
    const currency = ADZUNA_CURRENCIES[country];
    if (!currency) return [];

    // Adzuna has no "this phrase or that one", so a search in two languages
    // is two searches. Ads in the local language come first: in Germany
    // "Pflegefachkraft" finds about 90 times as many as "nurse".
    const terms = localQuery ? [localQuery, query] : [query];
    const settled = await Promise.allSettled(
      terms.map((what) => this.fetchResults(appId, appKey, country, what, location, limit)),
    );
    const found = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
    // A failure is thrown, not turned into an empty list: the page tells
    // "couldn't reach Adzuna" apart from "Adzuna had nothing". The service
    // logs it. One language answering is enough.
    if (found.length === 0) throw (settled[0] as PromiseRejectedResult).reason;

    return interleave(found)
      .slice(0, limit)
      .map((r, i) => this.toCandidate(r, i, currency));
  }

  private async fetchResults(
    appId: string,
    appKey: string,
    country: string,
    what: string,
    location: string,
    limit: number,
  ): Promise<AdzunaResult[]> {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: String(Math.min(limit, 50)),
      what,
      'content-type': 'application/json',
    });
    // "Toronto, ON" and "Toronto" both work as a place for Adzuna.
    if (location.trim()) params.set('where', location.trim());
    const json = (await fetchJson(
      `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`,
    )) as { results?: AdzunaResult[] };
    return json.results ?? [];
  }

  private toCandidate(r: AdzunaResult, i: number, currency: string): CandidateJob {
    return {
      id: `adzuna:${r.id ?? i}`,
      title: r.title ?? 'Role',
      company: cleanCompanyName(r.company?.display_name ?? '') || 'Company',
      location: r.location?.display_name?.trim() || '',
      description: r.description ?? '',
      url: r.redirect_url,
      // Adzuna reports salaries in the searched country's money.
      salary: formatPay(r.salary_min, r.salary_max, currency),
      source: this.name,
      postedAt: isoDate(r.created),
      employmentType: employmentTypeOf(r.contract_type === 'contract' ? 'contract' : r.contract_time),
      workplace: workplaceFromText(`${r.title ?? ''} ${r.location?.display_name ?? ''}`),
      // An estimate is not a stated salary: it is shown as before, but not sorted or filtered on.
      yearlyPay: r.salary_is_predicted === '1' ? undefined : yearlyPay(r.salary_min, r.salary_max, 'year', currency),
    };
  }
}

/** The countries Adzuna searches (as its API lists them), and each one's currency. */
const ADZUNA_CURRENCIES: Record<string, string> = {
  at: 'EUR', au: 'AUD', be: 'EUR', br: 'BRL', ca: 'CAD', ch: 'CHF', de: 'EUR', es: 'EUR', fr: 'EUR',
  gb: 'GBP', in: 'INR', it: 'EUR', mx: 'MXN', nl: 'EUR', nz: 'NZD', pl: 'PLN', sg: 'SGD', us: 'USD', za: 'ZAR',
};

/** Several result lists as one, taking from each in turn and showing a job once. */
function interleave(lists: AdzunaResult[][]): AdzunaResult[] {
  const out: AdzunaResult[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < Math.max(...lists.map((l) => l.length)); i++) {
    for (const list of lists) {
      const r = list[i];
      if (!r) continue;
      const id = r.id ?? `${r.title}|${r.company?.display_name}|${r.location?.display_name}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(r);
    }
  }
  return out;
}
