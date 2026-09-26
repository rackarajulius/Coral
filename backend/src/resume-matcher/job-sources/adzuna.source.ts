import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CandidateJob, JobSource, SearchInput, fetchJson } from './types';

interface AdzunaResult {
  id?: string;
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description?: string;
  redirect_url?: string;
  salary_min?: number;
  salary_max?: number;
}

/**
 * Adzuna job-search API (Canada by default). Structured, ToS-friendly.
 * Disabled unless ADZUNA_APP_ID + ADZUNA_APP_KEY are configured.
 */
@Injectable()
export class AdzunaJobSource implements JobSource {
  readonly name = 'adzuna' as const;
  private readonly logger = new Logger(AdzunaJobSource.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return !!this.config.get<string>('ADZUNA_APP_ID') && !!this.config.get<string>('ADZUNA_APP_KEY');
  }

  async search({ query, location, limit }: SearchInput): Promise<CandidateJob[]> {
    const appId = this.config.get<string>('ADZUNA_APP_ID');
    const appKey = this.config.get<string>('ADZUNA_APP_KEY');
    const country = this.config.get<string>('ADZUNA_COUNTRY', 'ca');
    if (!appId || !appKey) return [];

    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: String(Math.min(limit, 50)),
      what: query,
      'content-type': 'application/json',
    });
    if (location.trim()) params.set('where', location.trim());

    try {
      const json = (await fetchJson(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`,
      )) as { results?: AdzunaResult[] };

      return (json.results ?? []).map((r, i) => ({
        id: `adzuna:${r.id ?? i}`,
        title: r.title ?? 'Role',
        company: r.company?.display_name?.trim() || 'Company',
        location: r.location?.display_name?.trim() || '',
        description: r.description ?? '',
        url: r.redirect_url,
        salary: this.formatSalary(r.salary_min, r.salary_max),
        source: this.name,
      }));
    } catch (err) {
      this.logger.warn(`Adzuna search failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  private formatSalary(min?: number, max?: number): string | undefined {
    if (!min && !max) return undefined;
    const k = (n: number) => (n >= 1000 ? `C$${Math.round(n / 1000)}k` : `C$${Math.round(n)}`);
    if (min && max) return `${k(min)}–${k(max)}`;
    return k((min ?? max) as number);
  }
}
