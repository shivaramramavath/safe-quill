import { Logger } from '@nestjs/common';
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

  async summarizeRich(dto: SummarizeRequest): Promise<SummarizeResponse> {
    this.checkHalfOpen();
    if (this.state === 'OPEN') {
      return this.emergencySummarizeFallback(dto);
    }
    try {
      if (this.inner.summarizeRich) {
        const res = await this.inner.summarizeRich(dto);
        this.recordSuccess();
        return res;
      }
      const simple = await this.inner.summarize(dto.text);
      return {
        summary: simple,
        mode: dto.mode,
        intent: 'General Communication',
        tone: 'Neutral',
        language: 'English',
        readingTimeMin: 1,
      };
    } catch (err: any) {
      this.recordFailure(err);
      return this.emergencySummarizeFallback(dto);
    }
  }

  private emergencySummarizeFallback(dto: SummarizeRequest): SummarizeResponse {
    const rawClean = dto.text
      .replace(/^subject:\s*.*$/gim, '')
      .replace(/^(dear|hello|hi|hey|greetings)\b[^\n,.]*[,.]?/gim, '')
      .trim();
    const sentences = rawClean
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    const substantive = sentences.filter(
      (s) => s.length > 10 && !/^(best regards|sincerely|thanks|cheers|warm regards)/i.test(s),
    );
    const mainIdea = substantive[0] || sentences[0] || 'Email overview unavailable.';

    const dates = dto.text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi) || [];
    const amounts = dto.text.match(/[\$€£]\s?\d+(?:,\d{3})*(?:\.\d{2})?|\b\d+\s?(?:USD|EUR|GBP|INR|dollars|cents)\b/gi) || [];
    const links = dto.safeSummary ? [] : (dto.text.match(/https?:\/\/\S+/g) || []);
    const nameMatches = Array.from(new Set(dto.text.match(/\b[A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+)+\b/g) || []))
      .filter((n) => !['Dear Recipient', 'Best Regards', 'Safe Quill', 'Sincerely Yours', 'Recipient Name', 'Expression Of Interest'].includes(n));

    let summary = `Overview: ${mainIdea}`;
    let actionItems: Array<{ owner?: string; task: string; deadline?: string }> | undefined;
    let keyFacts: { dates: string[]; amounts: string[]; names: string[]; links: string[] } | undefined;

    if (dto.mode === 'tldr') {
      summary = `TL;DR: ${mainIdea}`;
    } else if (dto.mode === 'short') {
      const bullets = (substantive.length >= 2 ? substantive.slice(0, 3) : sentences.slice(0, 3))
        .map((s) => `• ${s}`);
      summary = bullets.join('\n');
    } else if (dto.mode === 'key_facts') {
      keyFacts = { dates, amounts, names: nameMatches, links };
      const bullets: string[] = [];
      if (nameMatches.length) bullets.push(`• Key Entities: ${nameMatches.join(', ')}`);
      if (dates.length) bullets.push(`• Dates: ${dates.join(', ')}`);
      if (amounts.length) bullets.push(`• Amounts: ${amounts.join(', ')}`);
      if (links.length) bullets.push(`• Links: ${links.join(', ')}`);
      summary = bullets.length > 0 ? bullets.join('\n') : `• Core Focus: ${mainIdea}`;
    } else if (dto.mode === 'action_items') {
      actionItems = [
        { owner: 'Recipient', task: 'Review email context and respond if required', deadline: 'Standard' },
      ];
      summary = `• [Recipient] Review email context and respond if required`;
    } else if (dto.mode === 'detailed') {
      summary = `The email pertains to "${mainIdea.slice(0, 120)}". Key context from message: ${substantive.slice(0, 2).join(' ')}`;
    }

    return {
      summary,
      mode: dto.mode,
      intent: 'General Communication',
      tone: 'Neutral',
      language: 'English',
      readingTimeMin: Math.max(1, Math.ceil(dto.text.trim().split(/\s+/).length / 200)),
      safetyNote: dto.safeSummary ? 'Safe summary mode enabled (circuit breaker active).' : undefined,
      actionItems,
      keyFacts,
    };
  }

  async generateDraft(
    dto: GenerateDraftRequest,
  ): Promise<{ drafts: Array<{ subject: string; body: string }> }> {
    this.checkHalfOpen();
    if (this.state === 'OPEN') {
      return this.emergencyDraftFallback(dto);
    }
    try {
      if (this.inner.generateDraft) {
        const res = await this.inner.generateDraft(dto);
        this.recordSuccess();
        return res;
      }
      return this.emergencyDraftFallback(dto);
    } catch (err: any) {
      this.recordFailure(err);
      return this.emergencyDraftFallback(dto);
    }
  }

  private emergencyDraftFallback(dto: GenerateDraftRequest): { drafts: Array<{ subject: string; body: string }> } {
    const subject = dto.currentSubject || `Regarding: ${dto.prompt.slice(0, 35)}`;
    const body = `Dear ${dto.recipient || 'Team'},\n\nI am contacting you regarding ${dto.prompt}.\n\nPlease review and let me know your feedback.\n\nBest regards,\nSafeQuill User`;
    return { drafts: [{ subject, body }] };
  }

  async executeAction(dto: AiActionRequest): Promise<AiActionResponse> {
    this.checkHalfOpen();
    if (this.state === 'OPEN') {
      return this.emergencyActionFallback(dto);
    }
    try {
      if (this.inner.executeAction) {
        const res = await this.inner.executeAction(dto);
        this.recordSuccess();
        return res;
      }
      return this.emergencyActionFallback(dto);
    } catch (err: any) {
      this.recordFailure(err);
      return this.emergencyActionFallback(dto);
    }
  }

  private emergencyActionFallback(dto: AiActionRequest): AiActionResponse {
    return {
      resultText: dto.text,
      explanation: `Action "${dto.action}" completed via circuit breaker fallback.`,
    };
  }
}
