import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CandidateJob,
  JobSource,
  SearchInput,
  fetchJson,
  queryTerms,
  matchesTerms,
  titleCase,
} from './types';

interface LeverPosting {
  id?: string;
  text?: string;
  categories?: { location?: string; team?: string; commitment?: string };
  hostedUrl?: string;
  descriptionPlain?: string;
}

/**
 * Direct-from-employer jobs via the public Lever postings API.
 * Matched by company, so it reads a configured list of Lever handles.
 * Set LEVER_COMPANIES="netflix,brex,…" (comma-separated). No key needed.
 */
@Injectable()
export class LeverJobSource implements JobSource {
  readonly name = 'lever' as const;
  private readonly logger = new Logger(LeverJobSource.name);

  constructor(private readonly config: ConfigService) {}

  private companies(): string[] {
    return (this.config.get<string>('LEVER_COMPANIES') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  isEnabled(): boolean {
    return this.companies().length > 0;
  }

  async search({ query, limit }: SearchInput): Promise<CandidateJob[]> {
    const companies = this.companies();
    if (companies.length === 0) return [];

    const terms = queryTerms(query);
    const perCompany = Math.max(3, Math.ceil(limit / companies.length));
    const results = await Promise.allSettled(companies.map((c) => this.fetchCompany(c, terms, perCompany)));
    return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).slice(0, limit);
  }

  private async fetchCompany(handle: string, terms: string[], take: number): Promise<CandidateJob[]> {
    try {
      const json = (await fetchJson(
        `https://api.lever.co/v0/postings/${encodeURIComponent(handle)}?mode=json`,
        { timeoutMs: 8000 },
      )) as LeverPosting[];

      const company = titleCase(handle);
      return (Array.isArray(json) ? json : [])
        .map((p) => ({
          id: `lever:${handle}:${p.id}`,
          title: p.text ?? 'Role',
          company,
          location: p.categories?.location?.trim() || '',
          description: p.descriptionPlain ?? '',
          url: p.hostedUrl,
          source: this.name,
        }))
        .filter((j) => matchesTerms(`${j.title} ${j.location} ${j.description}`, terms))
        .slice(0, take);
    } catch (err) {
      this.logger.warn(`Lever company "${handle}" failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }
}
