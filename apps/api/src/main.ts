import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { RedactingLogger } from './infrastructure/logger/redacting-logger.service';

async function bootstrap() {
  const logger = new RedactingLogger('SafeQuillAPI');
  const app = await NestFactory.create(AppModule, {
    logger,
  });

  // Security headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Cookie parser for reading guest session cookies
  app.use(cookieParser());

  // CORS configured to allow credentials (cookies)
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: [allowedOrigin, 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 4000;
  await app.listen(port);
  logger.log(`SafeQuill API server running securely on port ${port}`);
}

bootstrap();
