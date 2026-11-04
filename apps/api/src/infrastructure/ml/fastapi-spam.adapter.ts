import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SpamClassifierPort, SpamClassifierResult } from '../../domain/ports/spam-classifier.port';
import { TokenWeight } from '@safe-quill/shared';

@Injectable()
export class FastApiSpamAdapter implements SpamClassifierPort {
  private readonly logger = new Logger(FastApiSpamAdapter.name);
  private readonly mlServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.mlServiceUrl = this.configService.get<string>(
      'ML_SERVICE_URL',
      'http://localhost:8000',
    );
  }

  async classify(text: string): Promise<SpamClassifierResult> {
    if (!text || !text.trim()) {
      return {
        label: 'ham',
        confidence: 0.0,
        score: 0,
        level: 'LOW',
        topTokens: [],
        modelVersion: 'v1.0.0',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${this.mlServiceUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return {
          label: data.label,
          confidence: data.confidence,
          score: data.score,
          level: data.level,
          topTokens: (data.top_tokens || []).map((t: any) => ({
            token: t.token,
            weight: t.weight,
          })),
          modelVersion: data.model_version || 'v1.0.0',
        };
      }
    } catch {
      // FastAPI service offline or unreachable — fallback gracefully
      this.logger.debug(
        `FastAPI service at ${this.mlServiceUrl} unavailable. Executing resilient fallback classifier.`,
      );
    }

    return this.fallbackClassify(text);
  }

  private fallbackClassify(text: string): SpamClassifierResult {
    const lower = text.toLowerCase();
    const spamTokens = [
      { pattern: /\b(urgent|immediately|suspended|suspicious|verify|security alert)\b/g, token: 'urgent/verify', weight: 0.85 },
      { pattern: /\b(prize|won|winner|gift card|claim|exclusive offer|1000)\b/g, token: 'prize/won', weight: 0.88 },
      { pattern: /\b(password|credentials|reset your|unauthorized login)\b/g, token: 'credentials/reset', weight: 0.82 },
      { pattern: /\b(wire transfer|deposit|bitcoin|crypto|offshore|inheritance)\b/g, token: 'wire/crypto', weight: 0.92 },
      { pattern: /\b(invoice|unpaid|debt|terminated|overdue)\b/g, token: 'invoice/unpaid', weight: 0.75 },
    ];

    const detectedTokens: TokenWeight[] = [];
    let cumulativeRisk = 0;

    for (const item of spamTokens) {
      const matches = lower.match(item.pattern);
      if (matches) {
        cumulativeRisk += item.weight * Math.min(matches.length, 3);
        detectedTokens.push({ token: matches[0], weight: item.weight });
      }
    }

    const score = Math.min(100, Math.round(cumulativeRisk * 35));
    const label = score >= 50 ? 'spam' : 'ham';
    const level = score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';

    return {
      label,
      confidence: score >= 50 ? score / 100 : (100 - score) / 100,
      score,
      level,
      topTokens: detectedTokens,
      modelVersion: 'v1.0.0-fallback',
    };
  }
}
