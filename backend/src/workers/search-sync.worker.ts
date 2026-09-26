import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../services/queue/queue.service';

@Injectable()
export class SearchSyncWorker {
  private readonly logger = new Logger(SearchSyncWorker.name);

  constructor(private readonly queueService: QueueService) {}

  async runOnce() {
    const jobs = this.queueService.listPending(20).filter((job) => job.name === 'search.sync');
    this.logger.debug(`Search sync worker scanned ${jobs.length} queued jobs`);
    return jobs;
  }
}

