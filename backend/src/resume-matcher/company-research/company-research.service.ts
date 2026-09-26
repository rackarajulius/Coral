import { Injectable } from '@nestjs/common';
import { AiService, CompanyResearch } from '../../services/ai/ai.service';
import { FirecrawlClient } from './firecrawl.client';

export interface CompanyResearchResult {
  /** false when Firecrawl isn't configured — the UI shows a "not set up" note. */
  configured: boolean;
  profile: CompanyResearch | null;
  sources: { title: string; url: string }[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — company facts don't change fast

@Injectable()
export class CompanyResearchService {
  private readonly cache = new Map<string, { at: number; value: CompanyResearchResult }>();

  constructor(
    private readonly ai: AiService,
    private readonly firecrawl: FirecrawlClient,
  ) {}

  async research(company: string, jobTitle?: string): Promise<CompanyResearchResult> {
    const name = (company || '').trim();
    if (!name || !this.firecrawl.isEnabled()) {
      return { configured: this.firecrawl.isEnabled() && !!name, profile: null, sources: [] };
    }

    const cacheKey = name.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

    // One web search that returns scraped markdown for the top pages.
    const query = jobTitle ? `${name} company overview careers` : `${name} company overview`;
    const results = await this.firecrawl.searchWithContent(query, 4);
    if (results.length === 0) {
      return { configured: true, profile: null, sources: [] };
    }

    const sourcesText = results
      .map((r) => `Source: ${r.title} (${r.url})\n${r.markdown}`)
      .join('\n\n---\n\n');

    const profile = await this.ai.researchCompany(name, sourcesText);
    const value: CompanyResearchResult = {
      configured: true,
      profile,
      sources: results.map((r) => ({ title: r.title, url: r.url })),
    };
    this.cache.set(cacheKey, { at: Date.now(), value });
    return value;
  }
}
