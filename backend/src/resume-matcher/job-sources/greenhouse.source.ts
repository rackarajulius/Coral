import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CandidateJob,
  EmployerBoard,
  JobSource,
  SearchInput,
  cachedBoardJson,
  parseBoards,
  isoDate,
  searchBoards,
  stripHtml,
  workplaceFromText,
} from './types';

interface GreenhouseJob {
  id?: number;
  title?: string;
  absolute_url?: string;
  location?: { name?: string };
  content?: string;
  first_published?: string;
  updated_at?: string;
}

/**
 * Direct-from-employer jobs via the public Greenhouse job-board API.
 * Matched by company, so it reads a configured list of board tokens.
 * Set GREENHOUSE_BOARDS="clutch:Clutch,geotab:Geotab,…" (comma-separated,
 * the name optional). No key needed.
 */
@Injectable()
export class GreenhouseJobSource implements JobSource {
  readonly name = 'greenhouse' as const;
  private readonly logger = new Logger(GreenhouseJobSource.name);

  constructor(private readonly config: ConfigService) {}

  private boards(): EmployerBoard[] {
    return parseBoards(this.config.get<string>('GREENHOUSE_BOARDS'));
  }

  isEnabled(): boolean {
    return this.boards().length > 0;
  }

  search({ query, location, limit }: SearchInput): Promise<CandidateJob[]> {
    return searchBoards(
      'Greenhouse',
      this.boards(),
      (b) => this.fetchBoard(b),
      query,
      limit,
      (m) => this.logger.warn(m),
      location,
    );
  }

  private async fetchBoard({ token, company, domain }: EmployerBoard): Promise<CandidateJob[]> {
    const json = (await cachedBoardJson(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`,
    )) as { jobs?: GreenhouseJob[] };

    return (json.jobs ?? []).map((j) => ({
      id: `greenhouse:${token}:${j.id}`,
      title: j.title ?? 'Role',
      company,
      location: j.location?.name?.trim() || '',
      description: stripHtml(j.content ?? ''),
      url: j.absolute_url,
      source: this.name,
      companyDomain: domain,
      postedAt: isoDate(j.first_published ?? j.updated_at),
      workplace: workplaceFromText(j.location?.name),
    }));
  }
}
