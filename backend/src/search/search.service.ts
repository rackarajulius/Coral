import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '../services/elasticsearch/elasticsearch.service';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  searchAll(query: SearchQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    return {
      data: {
        jobs: [],
        gigs: [],
        freelancers: [],
        companies: [],
      },
      meta: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
      searchEngine: this.elasticsearchService.getConfig().enabled
        ? 'elasticsearch'
        : 'database-fallback',
      message: 'Search module scaffolded. Full indexing and ranking are pending.',
    };
  }
}

