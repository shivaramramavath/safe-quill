import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  GrammarFix,
  RewriteMode,
  RiskEvidence,
  ToneAnalysis,
} from '@safe-quill/shared';
import {
  LlmGrammarResult,
  LlmPort,
  LlmRewriteResult,
} from '../../domain/ports/llm.port';
import { ContentHashCacheService } from '../cache/content-hash-cache.service';

export class CachedLlmDecorator implements LlmPort {
  private readonly logger = new Logger(CachedLlmDecorator.name);
  private readonly memoryCache = new Map<string, { data: any; expiresAt: number }>();

  constructor(
    private readonly inner: LlmPort,
    private readonly cacheService?: ContentHashCacheService,
  ) {}

  private hashKey(prefix: string, payload: string): string {
    return `llm:${prefix}:${crypto.createHash('sha256').update(payload).digest('hex')}`;
  }

  async rewrite(
    text: string,
    mode: RewriteMode,
    evidence: RiskEvidence[] = [],
  ): Promise<LlmRewriteResult> {
    const key = this.hashKey(`rewrite:${mode}`, text);
    const cached = this.getMemory<LlmRewriteResult>(key);
    if (cached) {
      this.logger.debug(`Cache hit for LLM rewrite (${mode})`);
      return cached;
    }

    const result = await this.inner.rewrite(text, mode, evidence);
    this.setMemory(key, result, 3600);
    return result;
  }

  async analyzeTone(text: string): Promise<ToneAnalysis> {
    const key = this.hashKey('tone', text);
    const cached = this.getMemory<ToneAnalysis>(key);
    if (cached) return cached;

    const result = await this.inner.analyzeTone(text);
    this.setMemory(key, result, 3600);
    return result;
  }

  async generateSubjects(text: string): Promise<string[]> {
    const key = this.hashKey('subjects', text);
    const cached = this.getMemory<string[]>(key);
    if (cached) return cached;

    const result = await this.inner.generateSubjects(text);
    this.setMemory(key, result, 3600);
    return result;
  }

  async explainGrammar(text: string): Promise<LlmGrammarResult> {
    return this.inner.explainGrammar(text);
  }

  async summarize(text: string): Promise<string> {
    return this.inner.summarize(text);
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    return this.inner.translate(text, targetLanguage);
  }

  async completeInline(text: string): Promise<string> {
    return this.inner.completeInline(text);
  }

  private getMemory<T>(key: string): T | null {
    const item = this.memoryCache.get(key);
    if (!item) return null;
    if (item.expiresAt <= Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }
    return item.data as T;
  }

  private setMemory(key: string, data: any, ttlSeconds: number): void {
    this.memoryCache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}
