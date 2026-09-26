import { Injectable } from '@nestjs/common';

export interface QueueJob {
  name: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

@Injectable()
export class QueueService {
  private readonly jobs: QueueJob[] = [];

  async enqueue(name: string, payload: Record<string, unknown>) {
    const job: QueueJob = {
      name,
      payload,
      createdAt: new Date().toISOString(),
    };
    this.jobs.push(job);
    return job;
  }

  listPending(limit = 50): QueueJob[] {
    return this.jobs.slice(-limit).reverse();
  }
}

