import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CandidateJob, JobSource, SearchInput, fetchJson } from './types';

interface JSearchJob {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_description?: string;
  job_apply_link?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
}

/**
 * JSearch (RapidAPI) — aggregates Google for Jobs (Indeed, LinkedIn, Glassdoor…).
 * Broadest single web source. Disabled unless JSEARCH_API_KEY (RapidAPI key) is set.
 */
@Injectable()
export class JSearchJobSource implements JobSource {
  readonly name = 'jsearch' as const;
  private readonly logger = new Logger(JSearchJobSource.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return !!this.config.get<string>('JSEARCH_API_KEY');
  }

  async search({ query, location, limit }: SearchInput): Promise<CandidateJob[]> {
    const apiKey = this.config.get<string>('JSEARCH_API_KEY');
    const country = this.config.get<string>('JSEARCH_COUNTRY', 'ca');
    if (!apiKey) return [];

    const q = location.trim() ? `${query} in ${location.trim()}` : query;
    const params = new URLSearchParams({ query: q, country, page: '1', num_pages: '1' });

    try {
      const json = (await fetchJson(`https://jsearch.p.rapidapi.com/search?${params.toString()}`, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
      })) as { data?: JSearchJob[] };

      return (json.data ?? []).slice(0, limit).map((j, i) => ({
        id: `jsearch:${j.job_id ?? i}`,
        title: j.job_title ?? 'Role',
        company: j.employer_name?.trim() || 'Company',
        location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', '),
        description: j.job_description ?? '',
        url: j.job_apply_link,
        salary: this.formatSalary(j.job_min_salary, j.job_max_salary, j.job_salary_currency),
        source: this.name,
      }));
    } catch (err) {
      this.logger.warn(`JSearch search failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  private formatSalary(min?: number, max?: number, currency?: string): string | undefined {
    if (!min && !max) return undefined;
    const cur = currency || 'CAD';
    const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${Math.round(n)}`);
    if (min && max) return `${cur} ${k(min)}–${k(max)}`;
    return `${cur} ${k((min ?? max) as number)}`;
  }
}
