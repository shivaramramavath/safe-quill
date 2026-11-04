import { Inject, Injectable, Logger } from '@nestjs/common';
import { maskPii } from '@safe-quill/shared';
import {
  NEXT_WORD_PORT,
  NextWordPort,
  NextWordSuggestion,
} from '../../domain/ports/next-word.port';
import { LLM_PORT, LlmPort } from '../../domain/ports/llm.port';

export interface SuggestNextWordDto {
  context: string;
  allowLlmTier?: boolean;
}

export interface GhostMetricsRecord {
  event: 'shown' | 'accepted' | 'dismissed';
  tier?: 'local' | 'groq';
  latencyBucket?: '<50ms' | '50-200ms' | '200-600ms' | '>600ms';
}

@Injectable()
export class GhostTextService {
  private readonly logger = new Logger(GhostTextService.name);

  // In-memory privacy-safe metric counters (no raw email text is ever logged)
  private readonly metrics = {
    shown: 0,
    accepted: 0,
    dismissed: 0,
    tierLocal: 0,
    tierGroq: 0,
    latencyBuckets: {
      '<50ms': 0,
      '50-200ms': 0,
      '200-600ms': 0,
      '>600ms': 0,
    },
  };

  constructor(
    @Inject(NEXT_WORD_PORT) private readonly nextWordPort: NextWordPort,
    @Inject(LLM_PORT) private readonly llmPort: LlmPort,
  ) {}

  public async suggestNextWord(
    dto: SuggestNextWordDto,
    sessionId?: string,
  ): Promise<{ suggestions: NextWordSuggestion[]; tier: 'local' | 'groq'; model: string }> {
    const rawContext = dto.context || '';
    if (!rawContext.trim() || rawContext.length > 600) {
      return { suggestions: [], tier: 'local', model: 'none' };
    }

    const startTime = Date.now();

    // 1. Sanitize context & mask PII before processing
    const { maskedText, restore } = maskPii(rawContext.slice(-600));

    // 2. Query Tier (a) local N-Gram model via decorated NextWordPort
    // Order: RateLimited -> Cached -> RiskFiltered -> CircuitBreaker -> FastApiNextWordAdapter
    const localCandidates = await this.nextWordPort.suggest(maskedText, 3, {
      sessionId,
    });

    const elapsedMs = Date.now() - startTime;
    this.recordLatency(elapsedMs);

    // If Tier (a) returned valid suggestions or Tier (b) is disabled, return immediately
    if (localCandidates.length > 0 || !dto.allowLlmTier) {
      const restored = localCandidates.map((c) => ({
        ...c,
        completion: restore(c.completion),
        tier: 'local' as const,
      }));
      this.metrics.tierLocal++;
      return {
        suggestions: restored,
        tier: 'local',
        model: 'ghost-ngram-v1.0.0',
      };
    }

    // 3. Tier (b) Groq sentence completion fallback (max 25 tokens, temp 0.3)
    try {
      const llmCompletion = await this.llmPort.completeInline(maskedText);
      if (
        llmCompletion &&
        llmCompletion.trim().length > 0 &&
        !llmCompletion.includes('http') &&
        !/\b(password|otp|wire|bank|transfer)\b/i.test(llmCompletion)
      ) {
        this.metrics.tierGroq++;
        return {
          suggestions: [
            {
              completion: restore(llmCompletion),
              confidence: 0.85,
              tier: 'groq',
            },
          ],
          tier: 'groq',
          model: 'groq-llama3-tier-b',
        };
      }
    } catch {
      // Fall back to empty list on Groq failure without exposing error
    }

    return { suggestions: [], tier: 'local', model: 'ghost-ngram-v1.0.0' };
  }

  public recordMetric(metric: GhostMetricsRecord): void {
    if (metric.event === 'shown') this.metrics.shown++;
    if (metric.event === 'accepted') this.metrics.accepted++;
    if (metric.event === 'dismissed') this.metrics.dismissed++;

    if (metric.tier === 'local') this.metrics.tierLocal++;
    if (metric.tier === 'groq') this.metrics.tierGroq++;

    if (metric.latencyBucket && metric.latencyBucket in this.metrics.latencyBuckets) {
      this.metrics.latencyBuckets[metric.latencyBucket]++;
    }
  }

  public getMetricsSummary() {
    return { ...this.metrics };
  }

  private recordLatency(elapsedMs: number) {
    if (elapsedMs < 50) this.metrics.latencyBuckets['<50ms']++;
    else if (elapsedMs < 200) this.metrics.latencyBuckets['50-200ms']++;
    else if (elapsedMs < 600) this.metrics.latencyBuckets['200-600ms']++;
    else this.metrics.latencyBuckets['>600ms']++;
  }
}
