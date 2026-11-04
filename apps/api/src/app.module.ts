import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { SESSION_STORE_PORT } from './domain/ports/session-store.port';
import { RedisSessionAdapter } from './infrastructure/redis/redis-session.adapter';
import { RedactingLogger } from './infrastructure/logger/redacting-logger.service';
import { SessionService } from './application/services/session.service';
import { SessionController } from './interfaces/controllers/session.controller';
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
  controllers: [SessionController],
  providers: [
    RedactingLogger,
    SessionService,
    GuestSessionInterceptor,
    {
      provide: SESSION_STORE_PORT,
      useClass: RedisSessionAdapter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [SessionService, SESSION_STORE_PORT],
})
export class AppModule {}
