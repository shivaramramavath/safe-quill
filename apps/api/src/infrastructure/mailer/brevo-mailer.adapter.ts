import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MailerPort,
  ReportEmailPayload,
  SecurityAlertPayload,
} from '../../domain/ports/mailer.port';

@Injectable()
export class BrevoMailerAdapter implements MailerPort {
  private readonly logger = new Logger(BrevoMailerAdapter.name);
  private readonly apiKey: string | undefined;
  private readonly senderEmail: string;
  private readonly senderName: string;

  // Track dispatched emails in-memory for testing/auditing
  public readonly sentEmails: Array<{
    type: 'magic-link' | 'report' | 'alert';
    to: string;
    subject: string;
    timestamp: string;
  }> = [];

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('BREVO_API_KEY');
    this.senderEmail =
      this.config.get<string>('BREVO_SENDER_EMAIL') || 'security@safequill.local';
    this.senderName =
      this.config.get<string>('BREVO_SENDER_NAME') || 'SafeQuill Security';
  }

  async sendMagicLink(email: string, magicUrl: string): Promise<boolean> {
    const masked = this.maskEmail(email);
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <h2 style="color: #000; margin-bottom: 16px; font-weight: 700;">SafeQuill Login</h2>
        <p style="color: #333; font-size: 15px; line-height: 1.5;">Click the link below to verify your email and sign in to SafeQuill. Any active guest session draft will be automatically claimed and saved to your account.</p>
        <div style="margin: 28px 0;">
          <a href="${magicUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Sign In to SafeQuill</a>
        </div>
        <p style="color: #777; font-size: 13px;">This link will expire in 15 minutes. If you did not request this email, you can safely ignore it.</p>
      </div>
    `;

    return this.dispatchEmail(email, 'Your SafeQuill Sign-In Link', html, 'magic-link');
  }

  async sendAnalysisReport(payload: ReportEmailPayload): Promise<boolean> {
    const riskBadge =
      payload.verdict === 'HIGH'
        ? '<span style="background: #ef4444; color: #fff; padding: 4px 10px; border-radius: 4px; font-weight: bold;">HIGH RISK</span>'
        : payload.verdict === 'MEDIUM'
        ? '<span style="background: #f59e0b; color: #fff; padding: 4px 10px; border-radius: 4px; font-weight: bold;">MEDIUM RISK</span>'
        : '<span style="background: #10b981; color: #fff; padding: 4px 10px; border-radius: 4px; font-weight: bold;">SAFE / HAM</span>';

    const cuesList = payload.cues && payload.cues.length > 0
      ? payload.cues.map((c) => `<li style="margin-bottom: 6px;">${this.escapeHtml(c)}</li>`).join('')
      : '<li>No risk indicators detected.</li>';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <h2 style="color: #000; margin-bottom: 8px;">SafeQuill Analysis Report</h2>
        <p style="color: #666; font-size: 14px; margin-bottom: 20px;">Analysis report generated for inspected email draft.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; font-weight: 600; color: #444;">Risk Verdict:</td>
            <td style="padding: 10px 0;">${riskBadge}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; font-weight: 600; color: #444;">Risk Score:</td>
            <td style="padding: 10px 0; font-weight: bold; font-size: 18px;">${payload.score} / 100</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; font-weight: 600; color: #444;">Subject:</td>
            <td style="padding: 10px 0;">${this.escapeHtml(payload.subject || '(No subject)')}</td>
          </tr>
        </table>

        <h3 style="color: #000; font-size: 16px; margin-top: 24px; margin-bottom: 8px;">Security Explanations & Evidence</h3>
        <ul style="color: #333; line-height: 1.5; padding-left: 20px; font-size: 14px;">
          ${cuesList}
        </ul>

        <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">Generated securely by SafeQuill AI Phishing & Spam Defense.</p>
      </div>
    `;

    return this.dispatchEmail(
      payload.toEmail,
      `SafeQuill Report: ${payload.subject ? payload.subject.slice(0, 40) : 'Email Analysis'} [Verdict: ${payload.verdict}]`,
      html,
      'report',
    );
  }

  async sendSecurityAlert(payload: SecurityAlertPayload): Promise<boolean> {
    const reasonsHtml = payload.criticalReasons
      .map((r) => `<li style="color: #b91c1c; font-weight: 600; margin-bottom: 4px;">${this.escapeHtml(r)}</li>`)
      .join('');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 2px solid #ef4444; border-radius: 8px;">
        <h2 style="color: #b91c1c; margin-bottom: 8px;">CRITICAL SECURITY ALERT: High-Risk Phishing Detected</h2>
        <p style="color: #333; font-size: 15px;">SafeQuill flagged an email draft with an elevated risk score of <strong>${payload.score}/100</strong>.</p>
        
        <h4 style="color: #000; margin-top: 20px; margin-bottom: 6px;">Critical Findings:</h4>
        <ul style="padding-left: 20px; font-size: 14px;">
          ${reasonsHtml}
        </ul>

        <p style="color: #555; font-size: 13px; margin-top: 20px;">Do NOT click links, download attachments, or reply with credentials.</p>
      </div>
    `;

    return this.dispatchEmail(
      payload.toEmail,
      `URGENT: High Risk Security Alert (${payload.score}/100)`,
      html,
      'alert',
    );
  }

  private async dispatchEmail(
    toEmail: string,
    subject: string,
    htmlContent: string,
    type: 'magic-link' | 'report' | 'alert',
  ): Promise<boolean> {
    const masked = this.maskEmail(toEmail);

    this.sentEmails.push({
      type,
      to: toEmail,
      subject,
      timestamp: new Date().toISOString(),
    });

    if (
      !this.apiKey ||
      this.apiKey === 'mock' ||
      this.apiKey === 'sandbox' ||
      this.apiKey.includes('placeholder') ||
      this.apiKey.includes('your_brevo')
    ) {
      this.logger.log(
        `[SANDBOX] Dispatching ${type} email to ${masked}. Subject: "${subject}". (Brevo API key not set or sandbox)`,
      );
      return true;
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: this.senderName, email: this.senderEmail },
          to: [{ email: toEmail }],
          subject,
          htmlContent,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Brevo API failed (${response.status}): ${errorText}`);
        return false;
      }

      this.logger.log(`Successfully dispatched ${type} email via Brevo to ${masked}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Error sending email to ${masked}: ${err.message}`);
      return false;
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const maskedLocal =
      local.length <= 2 ? `${local[0]}***` : `${local[0]}***${local[local.length - 1]}`;
    return `${maskedLocal}@${domain}`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
