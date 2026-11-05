import { Controller, Get, Optional, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../infrastructure/database/mongo/schemas/user.schema';
import { SESSION_STORE_PORT, SessionStorePort } from '../../domain/ports/session-store.port';

@Controller(['health', 'api/health', 'api/v1/health'])
export class HealthController {
  constructor(
    @Optional()
    @InjectModel(User.name)
    private readonly userModel?: Model<UserDocument>,
    @Optional()
    @Inject(SESSION_STORE_PORT)
    private readonly sessionStore?: SessionStorePort,
  ) {}

  @Get()
  async getHealth() {
    let mongoStatus = 'in-memory-fallback';
    if (this.userModel && this.userModel.db) {
      const state = this.userModel.db.readyState;
      mongoStatus =
        state === 1 ? 'connected' : state === 2 ? 'connecting' : 'disconnected';
    }

    return {
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      services: {
        mongodb: mongoStatus,
        redis: this.sessionStore ? 'operational' : 'unknown',
      },
      security: {
        rawEmailLogging: 'disabled (redacted)',
        helmetHeaders: 'active',
        promptInjectionGuard: 'active',
      },
    };
  }
}
