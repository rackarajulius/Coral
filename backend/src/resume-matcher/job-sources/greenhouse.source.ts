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
  stripHtml,
} from './types';

interface GreenhouseJob {
  id?: number;
  title?: string;
  absolute_url?: string;
  location?: { name?: string };
  content?: string;
}

/**
 * Direct-from-employer jobs via the public Greenhouse job-board API.
 * Matched by company, so it reads a configured list of board tokens.
 * Set GREENHOUSE_BOARDS="shopify,figma,…" (comma-separated). No key needed.
 */
@Injectable()
export class GreenhouseJobSource implements JobSource {
  readonly name = 'greenhouse' as const;
  private readonly logger = new Logger(GreenhouseJobSource.name);

  constructor(private readonly config: ConfigService) {}

  private boards(): string[] {
    return (this.config.get<string>('GREENHOUSE_BOARDS') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  isEnabled(): boolean {
    return this.boards().length > 0;
  }

  async search({ query, limit }: SearchInput): Promise<CandidateJob[]> {
    const boards = this.boards();
    if (boards.length === 0) return [];

    const terms = queryTerms(query);
    const perBoard = Math.max(3, Math.ceil(limit / boards.length));
    const results = await Promise.allSettled(boards.map((b) => this.fetchBoard(b, terms, perBoard)));
    return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).slice(0, limit);
  }

  private async fetchBoard(token: string, terms: string[], take: number): Promise<CandidateJob[]> {
    try {
      const json = (await fetchJson(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`,
        { timeoutMs: 8000 },
      )) as { jobs?: GreenhouseJob[] };

      const company = titleCase(token);
      return (json.jobs ?? [])
        .map((j) => ({
          id: `greenhouse:${token}:${j.id}`,
          title: j.title ?? 'Role',
          company,
          location: j.location?.name?.trim() || '',
          description: stripHtml(j.content ?? ''),
          url: j.absolute_url,
          source: this.name,
        }))
        .filter((j) => matchesTerms(`${j.title} ${j.location} ${j.description}`, terms))
        .slice(0, take);
    } catch (err) {
      this.logger.warn(`Greenhouse board "${token}" failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }
}
