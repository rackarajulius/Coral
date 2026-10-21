import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CandidateJob,
  EmployerBoard,
  JobSource,
  SearchInput,
  cachedBoardJson,
  employmentTypeOf,
  isoDate,
  parseBoards,
  searchBoards,
  workplaceFromText,
  workplaceOf,
  yearlyPay,
} from './types';

interface LeverPosting {
  id?: string;
  text?: string;
  categories?: { location?: string; team?: string; commitment?: string };
  createdAt?: number;
  workplaceType?: string;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
  hostedUrl?: string;
  descriptionPlain?: string;
}

/**
 * Direct-from-employer jobs via the public Lever postings API.
 * Matched by company, so it reads a configured list of Lever handles.
 * Set LEVER_COMPANIES="getmaple:Maple,achievers:Achievers,…" (comma-separated,
 * the name optional). No key needed.
 */
@Injectable()
export class LeverJobSource implements JobSource {
  readonly name = 'lever' as const;
  private readonly logger = new Logger(LeverJobSource.name);

  constructor(private readonly config: ConfigService) {}

  private companies(): EmployerBoard[] {
    return parseBoards(this.config.get<string>('LEVER_COMPANIES'));
  }

  isEnabled(): boolean {
    return this.companies().length > 0;
  }

  search({ query, location, limit }: SearchInput): Promise<CandidateJob[]> {
    return searchBoards(
      'Lever',
      this.companies(),
      (b) => this.fetchCompany(b),
      query,
      limit,
      (m) => this.logger.warn(m),
      location,
    );
  }

  private async fetchCompany({ token, company, domain }: EmployerBoard): Promise<CandidateJob[]> {
    const json = await cachedBoardJson(`https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`);
    // A handle Lever doesn't know answers 200 with {"ok":false}. Treated as
    // a failure, so a company that has left Lever shows up in the logs.
    if (!Array.isArray(json)) throw new Error('not a Lever board');

    return (json as LeverPosting[]).map((p) => ({
      id: `lever:${token}:${p.id}`,
      title: p.text ?? 'Role',
      company,
      location: p.categories?.location?.trim() || '',
      description: p.descriptionPlain ?? '',
      url: p.hostedUrl,
      source: this.name,
      companyDomain: domain,
      postedAt: isoDate(p.createdAt),
      employmentType: employmentTypeOf(p.categories?.commitment),
      workplace: workplaceOf(p.workplaceType) ?? workplaceFromText(p.categories?.location),
      yearlyPay: yearlyPay(p.salaryRange?.min, p.salaryRange?.max, p.salaryRange?.interval, p.salaryRange?.currency),
    }));
  }
}
