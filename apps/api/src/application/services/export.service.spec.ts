import { ExportService } from './export.service';

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    service = new ExportService();
  });

  it('should export plain text format with verdict header', () => {
    const res = service.exportTxt('Security Advisory', 'System updates completed.', 15, 'LOW');
    expect(res.format).toBe('txt');
    expect(res.contentType).toBe('text/plain; charset=utf-8');
    expect(res.content).toContain('SAFEQUILL EMAIL EXPORT');
    expect(res.content).toContain('Verdict: LOW');
    expect(res.content).toContain('System updates completed.');
  });

  it('should export RFC 822 compliant .eml message format', () => {
    const res = service.exportEml('Meeting Notice', 'Discussing Q4 roadmap', 'boss@corp.com');
    expect(res.format).toBe('eml');
    expect(res.contentType).toBe('message/rfc822');
    expect(res.content).toContain('From: boss@corp.com');
    expect(res.content).toContain('Subject: Meeting Notice');
    expect(res.content).toContain('MIME-Version: 1.0');
    expect(res.content).toContain('Discussing Q4 roadmap');
  });

  it('should export JSON security audit report', () => {
    const payload = { score: 90, level: 'HIGH', isSpam: true };
    const res = service.exportJson(payload);
    expect(res.format).toBe('json');
    expect(JSON.parse(res.content).score).toBe(90);
  });
});
