import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchJson } from '../job-sources/types';

export interface ScrapedResult {
  url: string;
  title: string;
  markdown: string;
}

interface FirecrawlSearchItem {
  url?: string;
  title?: string;
  markdown?: string;
  content?: string;
  description?: string;
}

/**
 * Firecrawl — web search that returns clean scraped markdown per result, in one
 * call. Powers the company-research agent. Disabled unless FIRECRAWL_API_KEY set.
 */
@Injectable()
export class FirecrawlClient {
  private readonly logger = new Logger(FirecrawlClient.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return !!this.config.get<string>('FIRECRAWL_API_KEY');
  }

  /** Search the web for `query`, returning the top results with scraped markdown. */
  async searchWithContent(query: string, limit = 4): Promise<ScrapedResult[]> {
    const key = this.config.get<string>('FIRECRAWL_API_KEY');
    if (!key) return [];

    try {
      const json = (await fetchJson('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit, scrapeOptions: { formats: ['markdown'] } }),
        timeoutMs: 25000,
      })) as { data?: FirecrawlSearchItem[] };

      return (json.data ?? [])
        .map((d) => ({
          url: d.url ?? '',
          title: (d.title || d.url || '').trim(),
          markdown: (d.markdown ?? d.content ?? d.description ?? '').slice(0, 3000),
        }))
        .filter((d) => d.url && d.markdown);
    } catch (err) {
      this.logger.warn(`Firecrawl search failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }
}
