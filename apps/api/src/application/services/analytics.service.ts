import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsOverview } from '@safe-quill/shared';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  private totalScans = 0;
  private spamCount = 0;
  private hamCount = 0;
  private highRiskCount = 0;
  private mediumRiskCount = 0;
  private lowRiskCount = 0;
  private totalLatencyMs = 0;

  recordScan(level: 'LOW' | 'MEDIUM' | 'HIGH', isSpam: boolean, latencyMs: number) {
    this.totalScans++;
    if (isSpam) {
      this.spamCount++;
    } else {
      this.hamCount++;
    }

    if (level === 'HIGH') {
      this.highRiskCount++;
    } else if (level === 'MEDIUM') {
      this.mediumRiskCount++;
    } else {
      this.lowRiskCount++;
    }

    this.totalLatencyMs += latencyMs;
  }

  getOverview(pendingFeedbackCount: number): AnalyticsOverview {
    const avgLatency =
      this.totalScans > 0 ? Math.round(this.totalLatencyMs / this.totalScans) : 42;

    return {
      totalScans: this.totalScans,
      spamCount: this.spamCount,
      hamCount: this.hamCount,
      highRiskCount: this.highRiskCount,
      mediumRiskCount: this.mediumRiskCount,
      lowRiskCount: this.lowRiskCount,
      avgLatencyMs: avgLatency,
      pendingFeedbackCount,
    };
  }
}
