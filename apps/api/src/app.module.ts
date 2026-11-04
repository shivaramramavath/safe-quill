import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';

// Ports
import { SESSION_STORE_PORT } from './domain/ports/session-store.port';
import { SPAM_CLASSIFIER_PORT } from './domain/ports/spam-classifier.port';
import { LLM_PORT } from './domain/ports/llm.port';
import { USER_REPOSITORY_PORT } from './domain/ports/user-repository.port';
import { SAVED_SESSION_REPOSITORY_PORT } from './domain/ports/saved-session-repository.port';
import { MAILER_PORT } from './domain/ports/mailer.port';

// Adapters & Repositories
import { RedisSessionAdapter } from './infrastructure/redis/redis-session.adapter';
import { FastApiSpamAdapter } from './infrastructure/ml/fastapi-spam.adapter';
import { GroqAdapter } from './infrastructure/llm/groq.adapter';
import { CircuitBreakerLlm } from './infrastructure/llm/circuit-breaker-llm';
import { CachedLlmDecorator } from './infrastructure/llm/cached-llm.decorator';
import { ContentHashCacheService } from './infrastructure/cache/content-hash-cache.service';
import { RedactingLogger } from './infrastructure/logger/redacting-logger.service';
import { MongoUserRepository } from './infrastructure/database/mongo/mongo-user.repository';
import { MongoSavedSessionRepository } from './infrastructure/database/mongo/mongo-saved-session.repository';
import { BrevoMailerAdapter } from './infrastructure/mailer/brevo-mailer.adapter';

// Mongo Schemas
import { User, UserSchema } from './infrastructure/database/mongo/schemas/user.schema';
import {
  SavedSessionModel,
  SavedSessionSchema,
} from './infrastructure/database/mongo/schemas/saved-session.schema';
import {
  MagicToken,
  MagicTokenSchema,
} from './infrastructure/database/mongo/schemas/magic-token.schema';
import {
  PredictionFeedbackModel,
  PredictionFeedbackSchema,
} from './infrastructure/database/mongo/schemas/prediction-feedback.schema';
import {
  AiFeedbackModel,
  AiFeedbackSchema,
} from './infrastructure/database/mongo/schemas/ai-feedback.schema';
import {
  SystemConfigModel,
  SystemConfigSchema,
} from './infrastructure/database/mongo/schemas/system-config.schema';
import {
  AuditLogModel,
  AuditLogSchema,
} from './infrastructure/database/mongo/schemas/audit-log.schema';

// Services & Pipeline
import { SessionService } from './application/services/session.service';
import { AnalysisFacade } from './application/facades/analysis.facade';
import { AnalysisPipeline } from './application/pipeline/analysis.pipeline';
import { AiAssistantService } from './application/services/ai-assistant.service';
import { LangGraphAssistantService } from './infrastructure/llm/langgraph-assistant.graph';
import { AuthService } from './application/services/auth.service';
import { SessionClaimService } from './application/services/session-claim.service';
import { SavedSessionService } from './application/services/saved-session.service';
import { FeedbackService } from './application/services/feedback.service';
import { AdminConfigService } from './application/services/admin-config.service';
import { AnalyticsService } from './application/services/analytics.service';
import { EmlParserService } from './application/services/eml-parser.service';
import { ExportService } from './application/services/export.service';

// Detectors & Scoring
import { DetectorFactory } from './domain/detectors/detector.factory';
import { PromptInjectionDetector } from './domain/detectors/prompt-injection.detector';
import { UrlAnalysisDetector } from './domain/detectors/url-analysis.detector';
import { SenderLookalikeDetector } from './domain/detectors/sender-lookalike.detector';
import { HeaderAnalysisDetector } from './domain/detectors/header-analysis.detector';
import { UrgencySocialEngineeringDetector } from './domain/detectors/urgency-social-engineering.detector';
import { SensitiveDataDetector } from './domain/detectors/sensitive-data.detector';
import { BecPatternDetector } from './domain/detectors/bec-pattern.detector';
import { AttachmentRiskDetector } from './domain/detectors/attachment-risk.detector';
import { QrPhishingDetector } from './domain/detectors/qr-phishing.detector';
import { MultilingualDetector } from './domain/detectors/multilingual.detector';
import { CompositeRiskScorer } from './domain/scoring/composite-risk.scorer';

// Controllers, Guards & Interceptors
import { SessionController } from './interfaces/controllers/session.controller';
import { AnalysisController } from './interfaces/controllers/analysis.controller';
import { AiController } from './interfaces/controllers/ai.controller';
import { AuthController } from './interfaces/controllers/auth.controller';
import { SavedSessionController } from './interfaces/controllers/saved-session.controller';
import { AccountController } from './interfaces/controllers/account.controller';
import { MailerController } from './interfaces/controllers/mailer.controller';
import { FeedbackController } from './interfaces/controllers/feedback.controller';
import { AdminController } from './interfaces/controllers/admin.controller';
import { ExportController } from './interfaces/controllers/export.controller';
import { HealthController } from './interfaces/controllers/health.controller';
import { GuestSessionInterceptor } from './interfaces/interceptors/guest-session.interceptor';
import { JwtAuthGuard } from './interfaces/http/guards/jwt-auth.guard';

const mongoImports = process.env.MONGODB_URI
  ? [
      MongooseModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          uri: config.get<string>('MONGODB_URI'),
          serverSelectionTimeoutMS: 5000,
          retryAttempts: 2,
          retryDelay: 1000,
        }),
      }),
      MongooseModule.forFeature([
        { name: User.name, schema: UserSchema },
        { name: SavedSessionModel.name, schema: SavedSessionSchema },
        { name: MagicToken.name, schema: MagicTokenSchema },
        { name: PredictionFeedbackModel.name, schema: PredictionFeedbackSchema },
        { name: AiFeedbackModel.name, schema: AiFeedbackSchema },
        { name: SystemConfigModel.name, schema: SystemConfigSchema },
        { name: AuditLogModel.name, schema: AuditLogSchema },
      ]),
    ]
  : [];

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
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('JWT_SECRET') ||
          'safe-quill-jwt-dev-secret-super-secure',
        signOptions: { expiresIn: '7d' },
      }),
    }),
    ...mongoImports,
  ],
  controllers: [
    SessionController,
    AnalysisController,
    AiController,
    AuthController,
    SavedSessionController,
    AccountController,
    MailerController,
    FeedbackController,
    AdminController,
    ExportController,
    HealthController,
  ],
  providers: [
    RedactingLogger,
    SessionService,
    AnalysisFacade,
    AnalysisPipeline,
    AiAssistantService,
    LangGraphAssistantService,
    AuthService,
    SessionClaimService,
    SavedSessionService,
    FeedbackService,
    AdminConfigService,
    AnalyticsService,
    EmlParserService,
    ExportService,
    DetectorFactory,
    CompositeRiskScorer,
    ContentHashCacheService,
    GuestSessionInterceptor,
    JwtAuthGuard,

    // Security Detectors
    PromptInjectionDetector,
    UrlAnalysisDetector,
    SenderLookalikeDetector,
    HeaderAnalysisDetector,
    UrgencySocialEngineeringDetector,
    SensitiveDataDetector,
    BecPatternDetector,
    AttachmentRiskDetector,
    QrPhishingDetector,
    MultilingualDetector,

    {
      provide: SESSION_STORE_PORT,
      useClass: RedisSessionAdapter,
    },
    {
      provide: SPAM_CLASSIFIER_PORT,
      useClass: FastApiSpamAdapter,
    },
    {
      provide: USER_REPOSITORY_PORT,
      useClass: MongoUserRepository,
    },
    {
      provide: SAVED_SESSION_REPOSITORY_PORT,
      useClass: MongoSavedSessionRepository,
    },
    {
      provide: MAILER_PORT,
      useClass: BrevoMailerAdapter,
    },
    {
      provide: LLM_PORT,
      useFactory: (
        configService: ConfigService,
        promptInjection: PromptInjectionDetector,
        cacheService: ContentHashCacheService,
      ) => {
        const groq = new GroqAdapter(configService, promptInjection);
        const withCircuitBreaker = new CircuitBreakerLlm(groq);
        return new CachedLlmDecorator(withCircuitBreaker, cacheService);
      },
      inject: [ConfigService, PromptInjectionDetector, ContentHashCacheService],
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
    AiAssistantService,
    AuthService,
    SessionClaimService,
    SavedSessionService,
    FeedbackService,
    AdminConfigService,
    AnalyticsService,
    EmlParserService,
    ExportService,
    SESSION_STORE_PORT,
    SPAM_CLASSIFIER_PORT,
    LLM_PORT,
    USER_REPOSITORY_PORT,
    SAVED_SESSION_REPOSITORY_PORT,
    MAILER_PORT,
  ],
})
export class AppModule {}
