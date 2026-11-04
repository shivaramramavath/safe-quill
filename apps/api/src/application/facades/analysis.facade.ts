import { Inject, Injectable, Logger } from '@nestjs/common';
import { performance } from 'perf_hooks';
import { SpamClassificationDto } from '@safe-quill/shared';
import {
  SPAM_CLASSIFIER_PORT,
  SpamClassifierPort,
  SpamClassifierResult,
} from '../../domain/ports/spam-classifier.port';
import { ContentHashCacheService } from '../../infrastructure/cache/content-hash-cache.service';
import { AnalyzeDto } from '../dtos/analyze.dto';

@Injectable()
export class AnalysisFacade {
  private readonly logger = new Logger(AnalysisFacade.name);

  constructor(
    @Inject(SPAM_CLASSIFIER_PORT)
    private readonly spamClassifier: SpamClassifierPort,
    private readonly cacheService: ContentHashCacheService,
  ) {}

  async analyze(dto: AnalyzeDto): Promise<SpamClassificationDto> {
    const startTime = performance.now();

    // Normalize email payload (subject + body)
    const combinedContent = [dto.subject || '', dto.body].filter(Boolean).join('\n\n');

    if (!combinedContent.trim()) {
      return {
        label: 'ham',
        confidence: 0.0,
        score: 0,
        level: 'LOW',
        topTokens: [],
        modelVersion: 'v1.0.0',
        cached: false,
        latencyMs: 0,
      };
    }

    const contentHash = this.cacheService.computeHash(combinedContent);

    // 1. Check Redis cache by content hash
    const cachedResult = await this.cacheService.getCached(contentHash);
    if (cachedResult) {
      const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
      this.logger.debug(`Cache hit for content hash: ${contentHash.substring(0, 10)}... (${latencyMs}ms)`);
      return {
        ...cachedResult,
        cached: true,
        latencyMs,
      };
    }

    // 2. Cache miss -> run classification
    const classification: SpamClassifierResult = await this.spamClassifier.classify(
      combinedContent,
    );

    // 3. Store in Redis cache
    await this.cacheService.setCache(contentHash, classification);

    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
    this.logger.debug(
      `Classification completed in ${latencyMs}ms with verdict: ${classification.label} (score: ${classification.score})`,
    );

    return {
      ...classification,
      cached: false,
      latencyMs,
    };
  }
}
