import { ConfigService } from '@nestjs/config';
import { BrevoMailerAdapter } from './brevo-mailer.adapter';

describe('BrevoMailerAdapter', () => {
  let adapter: BrevoMailerAdapter;
  let mockConfig: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'BREVO_API_KEY') return 'mock';
        if (key === 'BREVO_SENDER_EMAIL') return 'alerts@safequill.local';
        if (key === 'BREVO_SENDER_NAME') return 'SafeQuill Security';
        return undefined;
      }),
    } as any;

    adapter = new BrevoMailerAdapter(mockConfig);
  });

  it('should dispatch magic link email in sandbox/mock mode and record entry', async () => {
    const success = await adapter.sendMagicLink(
      'user@example.com',
      'http://localhost:3000/auth/verify?token=abc123xyz',
    );

    expect(success).toBe(true);
    expect(adapter.sentEmails).toHaveLength(1);
    expect(adapter.sentEmails[0].type).toBe('magic-link');
    expect(adapter.sentEmails[0].to).toBe('user@example.com');
  });

  it('should dispatch analysis report email with score and verdict', async () => {
    const success = await adapter.sendAnalysisReport({
      toEmail: 'audit@example.com',
      subject: 'Urgent Wire Transfer',
      body: 'Please transfer funds immediately.',
      score: 85,
      verdict: 'HIGH',
      cues: ['BEC Pattern: Wire Transfer coercion detected'],
    });

    expect(success).toBe(true);
    expect(adapter.sentEmails).toHaveLength(1);
    expect(adapter.sentEmails[0].type).toBe('report');
    expect(adapter.sentEmails[0].subject).toContain('HIGH');
  });

  it('should dispatch critical security alert email', async () => {
    const success = await adapter.sendSecurityAlert({
      toEmail: 'soc@example.com',
      subject: 'Critical threat alert',
      score: 95,
      criticalReasons: ['Credential Harvester URL detected'],
    });

    expect(success).toBe(true);
    expect(adapter.sentEmails).toHaveLength(1);
    expect(adapter.sentEmails[0].type).toBe('alert');
    expect(adapter.sentEmails[0].subject).toContain('95/100');
  });
});
