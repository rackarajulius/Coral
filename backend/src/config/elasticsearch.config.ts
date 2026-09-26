import { registerAs } from '@nestjs/config';

export default registerAs('elasticsearch', () => ({
  node: process.env.ELASTICSEARCH_URL || '',
  username: process.env.ELASTICSEARCH_USERNAME || '',
  password: process.env.ELASTICSEARCH_PASSWORD || '',
  searchSyncQueueUrl: process.env.SEARCH_SYNC_QUEUE_URL || '',
}));

