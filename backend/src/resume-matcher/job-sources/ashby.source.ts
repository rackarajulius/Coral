import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CandidateJob,
  EmployerBoard,
  JobSource,
  SearchInput,
  YearlyPay,
  cachedBoardJson,
  employmentTypeOf,
  isoDate,
  parseBoards,
  searchBoards,
  workplaceFromText,
  workplaceOf,
  yearlyPay,
} from './types';

interface AshbyJob {
  id?: string;
  title?: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  isListed?: boolean;
  jobUrl?: string;
  descriptionPlain?: string;
  shouldDisplayCompensationOnJobPostings?: boolean;
  compensation?: {
    scrapeableCompensationSalarySummary?: string | null;
    compensationTierSummary?: string | null;
    summaryComponents?: Array<{
      compensationType?: string;
      interval?: string;
      currencyCode?: string;
      minValue?: number | null;
      maxValue?: number | null;
    }>;
  };
  publishedAt?: string;
  employmentType?: string;
  workplaceType?: string;
  isRemote?: boolean;
}

/**
 * Direct-from-employer jobs via Ashby's public job-board API.
 *
 * Many Canadian tech employers have moved here from Greenhouse and Lever:
 * Wealthsimple and Jobber were configured under those and both answered 404.
 * Set ASHBY_BOARDS="wealthsimple:Wealthsimple,jobber:Jobber,…" (comma-separated,
 * the name optional). No key needed.
 */
@Injectable()
export class AshbyJobSource implements JobSource {
  readonly name = 'ashby' as const;
  private readonly logger = new Logger(AshbyJobSource.name);

  constructor(private readonly config: ConfigService) {}

  private boards(): EmployerBoard[] {
    return parseBoards(this.config.get<string>('ASHBY_BOARDS'));
  }

  isEnabled(): boolean {
    return this.boards().length > 0;
  }

  search({ query, location, limit }: SearchInput): Promise<CandidateJob[]> {
    return searchBoards(
      'Ashby',
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
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}?includeCompensation=true`,
    )) as { jobs?: AshbyJob[] };
    if (!Array.isArray(json.jobs)) throw new Error('not an Ashby board');

    return json.jobs
      .filter((j) => j.isListed !== false)
      .map((j) => ({
        id: `ashby:${token}:${j.id}`,
        title: j.title ?? 'Role',
        company,
        location: this.location(j),
        description: j.descriptionPlain ?? '',
        url: j.jobUrl,
        salary: this.salary(j),
        source: this.name,
        companyDomain: domain,
        postedAt: isoDate(j.publishedAt),
        employmentType: employmentTypeOf(j.employmentType),
        workplace: workplaceOf(j.workplaceType) ?? (j.isRemote ? 'remote' : workplaceFromText(j.location)),
        yearlyPay: this.yearlyPay(j),
      }));
  }

  /** "Toronto (+2 more)" rather than only the first office of a multi-site role. */
  private location(j: AshbyJob): string {
    const primary = j.location?.trim() || '';
    const more = (j.secondaryLocations ?? []).filter((s) => s.location?.trim()).length;
    return more > 0 && primary ? `${primary} (+${more} more)` : primary;
  }

  /** The published salary as numbers, for sorting and filtering. */
  private yearlyPay(j: AshbyJob): YearlyPay | undefined {
    if (!j.shouldDisplayCompensationOnJobPostings) return undefined;
    const salary = j.compensation?.summaryComponents?.find((c) => c.compensationType === 'Salary');
    return salary ? yearlyPay(salary.minValue, salary.maxValue, salary.interval, salary.currencyCode) : undefined;
  }

  /** Only pay the employer chose to publish on the posting itself. */
  private salary(j: AshbyJob): string | undefined {
    if (!j.shouldDisplayCompensationOnJobPostings) return undefined;
    return j.compensation?.scrapeableCompensationSalarySummary || j.compensation?.compensationTierSummary || undefined;
  }
}
