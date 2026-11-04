import { Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import {
  NextWordPort,
  NextWordSuggestion,
  NextWordOptions,
} from '../../../domain/ports/next-word.port';

interface MemoryRateLimit {
  count: number;
  resetAt: number;
}

export class RateLimitedNextWordDecorator implements NextWordPort {
  private readonly logger = new Logger(RateLimitedNextWordDecorator.name);
  private readonly memoryLimits = new Map<string, MemoryRateLimit>();
  private readonly maxRequestsPerMinute = 60;
  private readonly windowSeconds = 60;

  constructor(
    private readonly delegate: NextWordPort,
    private readonly redisClient: Redis | null,
  ) {}

  public async suggest(
    context: string,
    topK = 3,
    options?: NextWordOptions,
  ): Promise<NextWordSuggestion[]> {
    const sessionId = options?.sessionId || 'guest-global';
    const now = Date.now();

    // 1. Check Rate Limit via Redis
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        const key = `ghost:ratelimit:${sessionId}`;
        const currentCount = await this.redisClient.incr(key);
        if (currentCount === 1) {
          await this.redisClient.expire(key, this.windowSeconds);
        }
        if (currentCount > this.maxRequestsPerMinute) {
          // Graceful drop on rate limit exceeded: return empty list, no UI error
          return [];
        }
      } catch {
        // Fall back to memory
      }
    } else {
      // Memory rate limit check
      let entry = this.memoryLimits.get(sessionId);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + this.windowSeconds * 1000 };
      }
      entry.count++;
      this.memoryLimits.set(sessionId, entry);

      if (entry.count > this.maxRequestsPerMinute) {
        return [];
      }
    }

    return this.delegate.suggest(context, topK, options);
  }
}
