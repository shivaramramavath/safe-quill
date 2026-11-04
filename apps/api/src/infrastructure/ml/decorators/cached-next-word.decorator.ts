import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import type Redis from 'ioredis';
import {
  NextWordPort,
  NextWordSuggestion,
  NextWordOptions,
} from '../../../domain/ports/next-word.port';

interface MemoryCacheEntry {
  data: NextWordSuggestion[];
  expiresAt: number;
}

export class CachedNextWordDecorator implements NextWordPort {
  private readonly logger = new Logger(CachedNextWordDecorator.name);
  private readonly memoryFallback = new Map<string, MemoryCacheEntry>();
  private readonly ttlSeconds = 600; // 10 minutes

  constructor(
    private readonly delegate: NextWordPort,
    private readonly redisClient: Redis | null,
  ) {}

  private getCacheKey(context: string): string {
    const tail = context.slice(-80);
    const hash = crypto.createHash('sha256').update(tail).digest('hex').slice(0, 16);
    return `ghost:cache:${hash}`;
  }

  public async suggest(
    context: string,
    topK = 3,
    options?: NextWordOptions,
  ): Promise<NextWordSuggestion[]> {
    if (!context) return [];

    const key = this.getCacheKey(context);
    const now = Date.now();

    // 1. Try Redis
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        const cached = await this.redisClient.get(key);
        if (cached) {
          return JSON.parse(cached) as NextWordSuggestion[];
        }
      } catch {
        // Fall back gracefully
      }
    } else {
      // Memory fallback check
      const memEntry = this.memoryFallback.get(key);
      if (memEntry && memEntry.expiresAt > now) {
        return memEntry.data;
      }
    }

    // 2. Cache miss: invoke delegate
    const results = await this.delegate.suggest(context, topK, options);

    // 3. Cache non-empty results for 10 min
    if (results && results.length > 0) {
      if (this.redisClient && this.redisClient.status === 'ready') {
        try {
          await this.redisClient.set(key, JSON.stringify(results), 'EX', this.ttlSeconds);
        } catch {
          // Ignore cache write error
        }
      } else {
        this.memoryFallback.set(key, {
          data: results,
          expiresAt: now + this.ttlSeconds * 1000,
        });
      }
    }

    return results;
  }
}
