import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { SpamClassifierResult } from '../../domain/ports/spam-classifier.port';

interface MemoryCacheEntry {
  data: SpamClassifierResult;
  expiresAt: number;
}

@Injectable()
export class ContentHashCacheService {
  private readonly logger = new Logger(ContentHashCacheService.name);
  private redisClient: Redis | null = null;
  private isConnected = false;
  private readonly memoryCache = new Map<string, MemoryCacheEntry>();

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD', '');

    try {
      this.redisClient = new Redis({
        host,
        port,
        password: password || undefined,
        lazyConnect: true,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });

      this.redisClient.on('connect', () => {
        this.isConnected = true;
      });

      this.redisClient.on('error', () => {
        this.isConnected = false;
      });

      this.redisClient.connect().catch(() => {});
    } catch {
      this.isConnected = false;
    }
  }

  computeHash(text: string): string {
    const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  }

  async getCached(hash: string): Promise<SpamClassifierResult | null> {
    const key = `cache:spam:${hash}`;

    if (this.isConnected && this.redisClient) {
      try {
        const raw = await this.redisClient.get(key);
        if (raw) {
          return JSON.parse(raw) as SpamClassifierResult;
        }
      } catch {
        // Fallback to memory cache
      }
    }

    const memoryEntry = this.memoryCache.get(key);
    if (!memoryEntry) return null;
    if (memoryEntry.expiresAt <= Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }
    return memoryEntry.data;
  }

  async setCache(
    hash: string,
    result: SpamClassifierResult,
    ttlSeconds = 7200,
  ): Promise<void> {
    const key = `cache:spam:${hash}`;
    const serialized = JSON.stringify(result);

    if (this.isConnected && this.redisClient) {
      try {
        await this.redisClient.set(key, serialized, 'EX', ttlSeconds);
        return;
      } catch {
        // Fallback to memory
      }
    }

    this.memoryCache.set(key, {
      data: result,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}
