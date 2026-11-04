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
        limit: 120, // 120 requests per minute per IP
      },
    ]),
  ],
  controllers: [SessionController, AnalysisController],
  providers: [
    RedactingLogger,
    SessionService,
    AnalysisFacade,
    ContentHashCacheService,
    GuestSessionInterceptor,
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
    SESSION_STORE_PORT,
    SPAM_CLASSIFIER_PORT,
  ],
})
export class AppModule {}
