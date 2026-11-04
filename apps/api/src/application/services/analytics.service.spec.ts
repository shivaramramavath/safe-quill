import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(() => {
    service = new AnalyticsService();
  });

  it('should aggregate scans and calculate running average latency', () => {
    service.recordScan('HIGH', true, 50);
    service.recordScan('LOW', false, 30);
    service.recordScan('MEDIUM', true, 40);

    const overview = service.getOverview(2);
    expect(overview.totalScans).toBe(3);
    expect(overview.spamCount).toBe(2);
    expect(overview.hamCount).toBe(1);
    expect(overview.highRiskCount).toBe(1);
    expect(overview.mediumRiskCount).toBe(1);
    expect(overview.lowRiskCount).toBe(1);
    expect(overview.avgLatencyMs).toBe(40);
    expect(overview.pendingFeedbackCount).toBe(2);
  });
});
