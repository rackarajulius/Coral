import { Injectable } from '@nestjs/common';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

@Injectable()
export class RedisService {
  private readonly memoryStore = new Map<string, CacheEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.memoryStore.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    this.memoryStore.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.memoryStore.delete(key);
  }
}

