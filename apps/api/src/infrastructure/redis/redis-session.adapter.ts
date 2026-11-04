import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { GuestSession } from '@safe-quill/shared';
import { SessionStorePort } from '../../domain/ports/session-store.port';

interface MemorySessionEntry {
  data: GuestSession;
  expiresAt: number;
}

@Injectable()
export class RedisSessionAdapter
  implements SessionStorePort, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisSessionAdapter.name);
  private redisClient: Redis | null = null;
  private isConnected = false;
  private readonly memoryStore = new Map<string, MemorySessionEntry>();
  private memoryCleanupInterval: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
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
        retryStrategy: () => null, // Don't infinite retry on boot if not up
      });

      this.redisClient.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`Connected to Redis at ${host}:${port}`);
      });

      this.redisClient.on('error', (err) => {
        if (this.isConnected) {
          this.logger.warn(`Redis connection error: ${err.message}. Falling back to in-memory store.`);
        }
        this.isConnected = false;
      });

      await this.redisClient.connect();
    } catch {
      this.isConnected = false;
      this.logger.warn(
        `Redis is unavailable at ${host}:${port}. Using high-performance in-memory fallback for guest sessions.`,
      );
    }

    // Periodic cleanup of expired entries in memory store
    this.memoryCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryStore.entries()) {
        if (entry.expiresAt <= now) {
          this.memoryStore.delete(key);
        }
      }
    }, 60000);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
    }
    if (this.redisClient) {
      await this.redisClient.quit().catch(() => {});
    }
  }

  private getKey(sessionId: string): string {
    return `session:guest:${sessionId}`;
  }

  async getSession(sessionId: string): Promise<GuestSession | null> {
    const key = this.getKey(sessionId);

    if (this.isConnected && this.redisClient) {
      try {
        const raw = await this.redisClient.get(key);
        if (raw) {
          return JSON.parse(raw) as GuestSession;
        }
        return null;
      } catch (err: any) {
        this.logger.warn(`Redis get failed (${err.message}), reading from memory fallback`);
      }
    }

    const entry = this.memoryStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.memoryStore.delete(key);
      return null;
    }
    return entry.data;
  }

  async saveSession(session: GuestSession, ttlSeconds: number = 86400): Promise<void> {
    const key = this.getKey(session.sessionId);
    const serialized = JSON.stringify(session);

    if (this.isConnected && this.redisClient) {
      try {
        await this.redisClient.set(key, serialized, 'EX', ttlSeconds);
        return;
      } catch (err: any) {
        this.logger.warn(`Redis set failed (${err.message}), persisting to memory fallback`);
      }
    }

    this.memoryStore.set(key, {
      data: session,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    const key = this.getKey(sessionId);
    if (this.isConnected && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch {
        // Fallback
      }
    }
    this.memoryStore.delete(key);
  }
}
