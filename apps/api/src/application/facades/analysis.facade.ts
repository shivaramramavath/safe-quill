import { Injectable, Logger } from '@nestjs/common';
import { performance } from 'perf_hooks';
import { RiskAnalysisResult } from '@safe-quill/shared';
import { ContentHashCacheService } from '../../infrastructure/cache/content-hash-cache.service';
import { AnalysisPipeline } from '../pipeline/analysis.pipeline';
import { AnalyzeDto } from '../dtos/analyze.dto';

@Injectable()
export class AnalysisFacade {
  private readonly logger = new Logger(AnalysisFacade.name);

  constructor(
    private readonly pipeline: AnalysisPipeline,
    private readonly cacheService: ContentHashCacheService,
  ) {}

  async analyze(dto: AnalyzeDto): Promise<RiskAnalysisResult> {
    const startTime = performance.now();

    const combinedContent = [dto.subject || '', dto.body].filter(Boolean).join('\n\n');

    if (!combinedContent.trim()) {
      return {
        score: 0,
        level: 'LOW',
        isSpam: false,
        confidence: 0,
        evidence: [],
        topTokens: [],
        modelVersion: 'v1.0.0',
        cached: false,
        latencyMs: 0,
      };
    }

    const contentHash = this.cacheService.computeHash(
      combinedContent + (dto.rawHeaders ? `\nheaders:${dto.rawHeaders}` : ''),
    );

    // 1. Redis Cache lookup
    const cachedResult = (await this.cacheService.getCached(contentHash)) as RiskAnalysisResult | null;
    if (cachedResult) {
      const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
      this.logger.debug(`Cache hit for content hash: ${contentHash.substring(0, 8)}... (${latencyMs}ms)`);
      return {
        ...cachedResult,
        cached: true,
        latencyMs,
      };
    }

    // 2. Cache miss -> run full analysis pipeline (Detectors + ML + Composite Scorer)
    const pipelineResult = await this.pipeline.run({
      subject: dto.subject,
      body: dto.body,
      rawHeaders: dto.rawHeaders,
    });

    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
    const finalResult: RiskAnalysisResult = {
      ...pipelineResult,
      cached: false,
      latencyMs,
    };

    // 3. Cache result in Redis
    await this.cacheService.setCache(contentHash, finalResult as any);

    this.logger.log(
      `Analysis completed in ${latencyMs}ms: Score ${finalResult.score}/100 (${finalResult.level}) with ${finalResult.evidence.length} evidence findings.`,
    );

    return finalResult;
  }
}
