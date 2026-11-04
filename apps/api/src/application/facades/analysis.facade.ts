import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { performance } from 'perf_hooks';
import { RiskAnalysisResult } from '@safe-quill/shared';
import { ContentHashCacheService } from '../../infrastructure/cache/content-hash-cache.service';
import { AnalysisPipeline } from '../pipeline/analysis.pipeline';
import { AnalyzeDto } from '../dtos/analyze.dto';
import { AnalyticsService } from '../services/analytics.service';
import { MAILER_PORT, MailerPort } from '../../domain/ports/mailer.port';
import { EmlParserService } from '../services/eml-parser.service';

@Injectable()
export class AnalysisFacade {
  private readonly logger = new Logger(AnalysisFacade.name);

  constructor(
    private readonly pipeline: AnalysisPipeline,
    private readonly cacheService: ContentHashCacheService,
    @Optional()
    private readonly analyticsService?: AnalyticsService,
    @Optional()
    @Inject(MAILER_PORT)
    private readonly mailer?: MailerPort,
    @Optional()
    private readonly configService?: ConfigService,
    @Optional()
    private readonly emlParser?: EmlParserService,
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

    // 4. Record anonymized analytics
    this.analyticsService?.recordScan(finalResult.level, finalResult.isSpam, finalResult.latencyMs);

    // 5. High-risk alert dispatch via Brevo if score >= 85
    if (finalResult.score >= 85 && this.mailer && this.configService) {
      const alertEmail = this.configService.get<string>('SECURITY_ALERT_EMAIL');
      if (alertEmail) {
        const criticalReasons = finalResult.evidence.map((e) => `${e.detectorName}: ${e.reason}`);
        this.mailer
          .sendSecurityAlert({
            toEmail: alertEmail,
            subject: dto.subject || 'Critical Threat Detected',
            score: finalResult.score,
            criticalReasons,
          })
          .catch((err) => this.logger.warn(`Security alert email error: ${err.message}`));
      }
    }

    this.logger.log(
      `Analysis completed in ${latencyMs}ms: Score ${finalResult.score}/100 (${finalResult.level}) with ${finalResult.evidence.length} evidence findings.`,
    );

    return finalResult;
  }

  async analyzeEml(emlString: string): Promise<RiskAnalysisResult & { parsedEml: any }> {
    if (!this.emlParser) {
      throw new Error('EmlParserService not available');
    }

    const parsed = this.emlParser.parse(emlString);
    const attachmentLines = parsed.attachments
      .map((a) => `X-Attachment: ${a.filename} (hash: ${a.sha256})`)
      .join('\n');
    const enrichedHeaders = [parsed.rawHeaders, attachmentLines].filter(Boolean).join('\n');

    const analysis = await this.analyze({
      subject: parsed.subject,
      body: parsed.body,
      rawHeaders: enrichedHeaders,
    });

    return {
      ...analysis,
      parsedEml: parsed,
    };
  }
}
