import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLogEntry, SystemConfig } from '@safe-quill/shared';
import { UpdateSystemConfigDto } from '../dtos/admin.dto';
import {
  SystemConfigDocument,
  SystemConfigModel,
} from '../../infrastructure/database/mongo/schemas/system-config.schema';
import {
  AuditLogDocument,
  AuditLogModel,
} from '../../infrastructure/database/mongo/schemas/audit-log.schema';

@Injectable()
export class AdminConfigService {
  private readonly logger = new Logger(AdminConfigService.name);

  // Active in-memory configuration cache
  private activeConfig: SystemConfig = {
    highThreshold: 75,
    mediumThreshold: 40,
    blockedDomains: ['phish-bank-login.xyz', 'malicious-portal.top'],
    blockedKeywords: ['wire funds immediately', 'crypto ransom'],
    updatedAt: new Date().toISOString(),
  };

  private readonly memoryAuditLogs: AuditLogEntry[] = [];

  constructor(
    @Optional()
    @InjectModel(SystemConfigModel.name)
    private readonly configModel?: Model<SystemConfigDocument>,
    @Optional()
    @InjectModel(AuditLogModel.name)
    private readonly auditModel?: Model<AuditLogDocument>,
  ) {
    this.init();
  }

  private async init() {
    if (this.configModel) {
      try {
        const found = await this.configModel.findOne().lean().exec();
        if (found) {
          this.activeConfig = {
            highThreshold: found.highThreshold,
            mediumThreshold: found.mediumThreshold,
            blockedDomains: found.blockedDomains || [],
            blockedKeywords: found.blockedKeywords || [],
            updatedAt: (found as any).updatedAt?.toISOString() || new Date().toISOString(),
          };
        }
      } catch (err: any) {
        this.logger.warn(`Failed to hydrate config from MongoDB: ${err.message}`);
      }
    }
  }

  getConfig(): SystemConfig {
    return { ...this.activeConfig };
  }

  async updateConfig(
    dto: UpdateSystemConfigDto,
    performedBy?: string,
  ): Promise<SystemConfig> {
    const changes: string[] = [];

    if (dto.highThreshold !== undefined) {
      changes.push(`High threshold: ${this.activeConfig.highThreshold} -> ${dto.highThreshold}`);
      this.activeConfig.highThreshold = dto.highThreshold;
    }

    if (dto.mediumThreshold !== undefined) {
      changes.push(`Medium threshold: ${this.activeConfig.mediumThreshold} -> ${dto.mediumThreshold}`);
      this.activeConfig.mediumThreshold = dto.mediumThreshold;
    }

    if (dto.blockedDomains !== undefined) {
      changes.push(`Blocked domains updated: ${dto.blockedDomains.length} domains`);
      this.activeConfig.blockedDomains = dto.blockedDomains;
    }

    if (dto.blockedKeywords !== undefined) {
      changes.push(`Blocked keywords updated: ${dto.blockedKeywords.length} keywords`);
      this.activeConfig.blockedKeywords = dto.blockedKeywords;
    }

    this.activeConfig.updatedAt = new Date().toISOString();

    // Persist to Mongo if available
    if (this.configModel) {
      try {
        await this.configModel.findOneAndUpdate(
          {},
          { $set: this.activeConfig },
          { upsert: true, new: true },
        );
      } catch (err: any) {
        this.logger.warn(`Failed to persist system config: ${err.message}`);
      }
    }

    // Record Audit Log
    const details = changes.join(', ');
    await this.recordAuditLog('CONFIG_UPDATE', details, performedBy);
    this.logger.log(`Admin updated system config: ${details}`);

    return { ...this.activeConfig };
  }

  async recordAuditLog(
    action: string,
    details: string,
    performedBy?: string,
  ): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      action,
      details,
      performedBy: performedBy || 'admin',
      timestamp: new Date().toISOString(),
    };

    if (this.auditModel) {
      try {
        await this.auditModel.create({
          action,
          details,
          performedBy: entry.performedBy,
        });
      } catch (err: any) {
        this.logger.warn(`Failed to write audit log to Mongo: ${err.message}`);
      }
    }

    this.memoryAuditLogs.unshift(entry);
    if (this.memoryAuditLogs.length > 100) {
      this.memoryAuditLogs.pop();
    }

    return entry;
  }

  getAuditLogs(): AuditLogEntry[] {
    return [...this.memoryAuditLogs];
  }
}
