import { Logger } from '@nestjs/common';
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

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreakerLlm implements LlmPort {
  private readonly logger = new Logger(CircuitBreakerLlm.name);

  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private readonly failureThreshold = 3;
  private readonly resetTimeoutMs = 30000; // 30 seconds
  private lastFailureTime = 0;

  constructor(private readonly inner: LlmPort) {}

  public getState(): CircuitState {
    this.checkHalfOpen();
    return this.state;
  }

  public recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  public recordFailure(err: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.logger.warn(`Circuit breaker failure #${this.failureCount}: ${err.message}`);

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.logger.error(`Circuit breaker tripped to OPEN! Tripping requests to fallback for ${this.resetTimeoutMs / 1000}s.`);
    }
  }

  private checkHalfOpen(): void {
    if (this.state === 'OPEN' && Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
      this.state = 'HALF_OPEN';
      this.logger.log('Circuit breaker entered HALF_OPEN state: attempting probe request.');
    }
  }

  async rewrite(
    text: string,
    mode: RewriteMode,
    evidence: RiskEvidence[] = [],
  ): Promise<LlmRewriteResult> {
    this.checkHalfOpen();

    if (this.state === 'OPEN') {
      this.logger.debug('Circuit is OPEN: returning fast fallback rewrite');
      return this.emergencyFallback(text, mode);
    }

    try {
      const result = await this.inner.rewrite(text, mode, evidence);
      this.recordSuccess();
      return result;
    } catch (err: any) {
      this.recordFailure(err);
      return this.emergencyFallback(text, mode);
    }
  }

  private emergencyFallback(text: string, mode: RewriteMode): LlmRewriteResult {
    let rewritten = text;
    if (mode === 'safe') {
      rewritten = rewritten.replace(/https?:\/\/[^\s<>"'{}|\\^`[\]]+/gi, '[Verified Link Removed]');
      rewritten = rewritten.replace(/\b(urgent|immediately|suspended|unauthorized)\b/gi, 'relevant');
      rewritten = `Hello,\n\n${rewritten.trim()}\n\nRegards,\nTeam`;
    }

    return {
      rewritten,
      explanation: 'Circuit Breaker Active: Safe text generated via resilient fallback engine.',
      provider: 'circuit-breaker-fallback',
    };
  }

  async analyzeTone(text: string): Promise<ToneAnalysis> {
    this.checkHalfOpen();
    if (this.state === 'OPEN') {
      return { tone: 'Neutral', politenessScore: 50, confidence: 0.8, summary: 'Fallback tone analysis (Circuit OPEN)' };
    }
    try {
      const res = await this.inner.analyzeTone(text);
      this.recordSuccess();
      return res;
    } catch (err: any) {
      this.recordFailure(err);
      return { tone: 'Neutral', politenessScore: 50, confidence: 0.8, summary: 'Fallback tone analysis (Circuit OPEN)' };
    }
  }

  async generateSubjects(text: string): Promise<string[]> {
    this.checkHalfOpen();
    if (this.state === 'OPEN') {
      return ['SafeQuill Notice: Follow up on email'];
    }
    try {
      const res = await this.inner.generateSubjects(text);
      this.recordSuccess();
      return res;
    } catch (err: any) {
      this.recordFailure(err);
      return ['SafeQuill Notice: Follow up on email'];
    }
  }

  async explainGrammar(text: string): Promise<LlmGrammarResult> {
    this.checkHalfOpen();
    if (this.state === 'OPEN') {
      return { fixes: [], correctedText: text };
    }
    try {
      const res = await this.inner.explainGrammar(text);
      this.recordSuccess();
      return res;
    } catch (err: any) {
      this.recordFailure(err);
      return { fixes: [], correctedText: text };
    }
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
}
