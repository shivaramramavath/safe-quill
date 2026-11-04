import { Injectable, Logger } from '@nestjs/common';
import {
  NextWordPort,
  NextWordSuggestion,
  NextWordOptions,
} from '../../domain/ports/next-word.port';

@Injectable()
export class FastApiNextWordAdapter implements NextWordPort {
  private readonly logger = new Logger(FastApiNextWordAdapter.name);
  private readonly mlBaseUrl: string;

  constructor() {
    this.mlBaseUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
  }

  public async suggest(
    context: string,
    topK = 3,
    _options?: NextWordOptions,
  ): Promise<NextWordSuggestion[]> {
    if (!context || context.length > 600) {
      return [];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 65); // 65ms network timeout

    try {
      const response = await fetch(`${this.mlBaseUrl}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, top_k: topK }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as {
        suggestions: Array<{ completion: string; confidence: number }>;
      };

      return (data.suggestions || []).map((s) => ({
        completion: s.completion,
        confidence: s.confidence,
        tier: 'local',
      }));
    } catch {
      // Return empty list on timeout or connection error (zero errors shown to UI)
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}
