import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ElasticsearchService {
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly endpoint: string;

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.get<string>('elasticsearch.node', '');
  }

  getConfig() {
    return {
      endpoint: this.endpoint,
      enabled: Boolean(this.endpoint),
    };
  }

  async upsert(index: string, id: string, document: Record<string, unknown>) {
    this.logger.debug(`Upsert requested for ${index}/${id}`);
    return {
      index,
      id,
      document,
      message: 'Elasticsearch sync is scaffolded. Provider integration pending.',
    };
  }

  async remove(index: string, id: string) {
    this.logger.debug(`Delete requested for ${index}/${id}`);
    return {
      index,
      id,
      message: 'Elasticsearch sync is scaffolded. Provider integration pending.',
    };
  }
}

