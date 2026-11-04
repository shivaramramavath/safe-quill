import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { SESSION_STORE_PORT } from './domain/ports/session-store.port';
import { SPAM_CLASSIFIER_PORT } from './domain/ports/spam-classifier.port';
import { RedisSessionAdapter } from './infrastructure/redis/redis-session.adapter';
import { FastApiSpamAdapter } from './infrastructure/ml/fastapi-spam.adapter';
import { ContentHashCacheService } from './infrastructure/cache/content-hash-cache.service';
import { RedactingLogger } from './infrastructure/logger/redacting-logger.service';
import { SessionService } from './application/services/session.service';
import { AnalysisFacade } from './application/facades/analysis.facade';
import { AnalysisPipeline } from './application/pipeline/analysis.pipeline';
import { DetectorFactory } from './domain/detectors/detector.factory';
import { PromptInjectionDetector } from './domain/detectors/prompt-injection.detector';
import { UrlAnalysisDetector } from './domain/detectors/url-analysis.detector';
import { SenderLookalikeDetector } from './domain/detectors/sender-lookalike.detector';
import { HeaderAnalysisDetector } from './domain/detectors/header-analysis.detector';
import { UrgencySocialEngineeringDetector } from './domain/detectors/urgency-social-engineering.detector';
import { SensitiveDataDetector } from './domain/detectors/sensitive-data.detector';
import { BecPatternDetector } from './domain/detectors/bec-pattern.detector';
import { CompositeRiskScorer } from './domain/scoring/composite-risk.scorer';
import { SessionController } from './interfaces/controllers/session.controller';
import { AnalysisController } from './interfaces/controllers/analysis.controller';
import { GuestSessionInterceptor } from './interfaces/interceptors/guest-session.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'guest-standard',
        ttl: 60000,
        limit: 120,
      },
    ]),
  ],
  controllers: [SessionController, AnalysisController],
  providers: [
    RedactingLogger,
    SessionService,
    AnalysisFacade,
    AnalysisPipeline,
    DetectorFactory,
    CompositeRiskScorer,
    ContentHashCacheService,
    GuestSessionInterceptor,

    // Security Detectors (Strategies)
    PromptInjectionDetector,
    UrlAnalysisDetector,
    SenderLookalikeDetector,
    HeaderAnalysisDetector,
    UrgencySocialEngineeringDetector,
    SensitiveDataDetector,
    BecPatternDetector,

    {
      provide: SESSION_STORE_PORT,
      useClass: RedisSessionAdapter,
    },
    {
      provide: SPAM_CLASSIFIER_PORT,
      useClass: FastApiSpamAdapter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [
    SessionService,
    AnalysisFacade,
    AnalysisPipeline,
    DetectorFactory,
    CompositeRiskScorer,
    SESSION_STORE_PORT,
    SPAM_CLASSIFIER_PORT,
  ],
})
export class AppModule {}
