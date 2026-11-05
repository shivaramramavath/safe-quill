import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  AiActionRequest,
  AiActionResponse,
  GenerateDraftRequest,
  GrammarFix,
  RewriteMode,
  RiskEvidence,
  SummarizeRequest,
  SummarizeResponse,
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

  async summarizeRich(dto: SummarizeRequest): Promise<SummarizeResponse> {
    const key = this.hashKey(`summary:${dto.mode}:${dto.safeSummary ? 'safe' : 'raw'}`, dto.text);
    const cached = this.getMemory<SummarizeResponse>(key);
    if (cached) {
      this.logger.debug(`Cache hit for summarizeRich (${dto.mode})`);
      return cached;
    }

    if (this.inner.summarizeRich) {
      const result = await this.inner.summarizeRich(dto);
      this.setMemory(key, result, 3600);
      return result;
    }

    const simple = await this.inner.summarize(dto.text);
    const fallbackRes: SummarizeResponse = {
      summary: simple,
      mode: dto.mode,
      intent: 'General Communication',
      tone: 'Neutral',
      language: 'English',
      readingTimeMin: 1,
    };
    this.setMemory(key, fallbackRes, 3600);
    return fallbackRes;
  }

  async generateDraft(
    dto: GenerateDraftRequest,
  ): Promise<{ drafts: Array<{ subject: string; body: string }> }> {
    if (this.inner.generateDraft) {
      return this.inner.generateDraft(dto);
    }
    return {
      drafts: [
        {
          subject: dto.currentSubject || `Regarding: ${dto.prompt.slice(0, 35)}`,
          body: `Hello,\n\nI am contacting you regarding ${dto.prompt}.\n\nBest regards,\nSafeQuill User`,
        },
      ],
    };
  }

  async executeAction(dto: AiActionRequest): Promise<AiActionResponse> {
    if (this.inner.executeAction) {
      return this.inner.executeAction(dto);
    }
    return {
      resultText: dto.text,
      explanation: `Action "${dto.action}" executed.`,
    };
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
