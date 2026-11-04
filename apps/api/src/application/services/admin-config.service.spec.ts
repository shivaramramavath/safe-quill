import { AdminConfigService } from './admin-config.service';

describe('AdminConfigService', () => {
  let service: AdminConfigService;

  beforeEach(() => {
    service = new AdminConfigService(undefined, undefined);
  });

  it('should return initial default thresholds and blocklists', () => {
    const config = service.getConfig();
    expect(config.highThreshold).toBe(75);
    expect(config.mediumThreshold).toBe(40);
    expect(config.blockedDomains).toContain('phish-bank-login.xyz');
  });

  it('should update thresholds and blocklists and record an audit log', async () => {
    const updated = await service.updateConfig(
      {
        highThreshold: 80,
        mediumThreshold: 45,
        blockedDomains: ['evil-scam.com', 'phish-bank-login.xyz'],
      },
      'admin-super',
    );

    expect(updated.highThreshold).toBe(80);
    expect(updated.mediumThreshold).toBe(45);
    expect(updated.blockedDomains).toContain('evil-scam.com');

    const auditLogs = service.getAuditLogs();
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('CONFIG_UPDATE');
    expect(auditLogs[0].details).toContain('80');
    expect(auditLogs[0].performedBy).toBe('admin-super');
  });
});
