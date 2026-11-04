export const MAILER_PORT = Symbol('MAILER_PORT');

export interface ReportEmailPayload {
  toEmail: string;
  subject: string;
  body: string;
  score: number;
  verdict: string;
  cues: string[];
}

export interface SecurityAlertPayload {
  toEmail: string;
  subject: string;
  score: number;
  criticalReasons: string[];
}

export interface MailerPort {
  sendMagicLink(email: string, magicUrl: string): Promise<boolean>;
  sendAnalysisReport(payload: ReportEmailPayload): Promise<boolean>;
  sendSecurityAlert(payload: SecurityAlertPayload): Promise<boolean>;
}
