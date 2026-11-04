import {
  Body,
  Controller,
  Inject,
  Logger,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { MAILER_PORT, MailerPort } from '../../domain/ports/mailer.port';
import { SendReportDto } from '../../application/dtos/auth.dto';

@Controller('api/v1/mailer')
export class MailerController {
  private readonly logger = new Logger(MailerController.name);

  constructor(
    @Inject(MAILER_PORT)
    private readonly mailer: MailerPort,
  ) {}

  @Post('report')
  async sendReport(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: SendReportDto,
  ): Promise<{ success: boolean; message: string }> {
    const success = await this.mailer.sendAnalysisReport({
      toEmail: dto.recipientEmail,
      subject: dto.subject || 'SafeQuill Email Inspection Report',
      body: dto.body || '',
      score: dto.score,
      verdict: dto.verdict,
      cues: dto.cues,
    });

    return {
      success,
      message: success
        ? 'Analysis report dispatched successfully.'
        : 'Failed to dispatch report email.',
    };
  }

  @Post('webhooks/brevo')
  async handleBrevoWebhook(@Body() payload: any): Promise<{ received: boolean }> {
    // Ingest Brevo webhook notifications (bounces, complaints, delivery stats)
    // Redact raw payload content in production
    const eventType = payload?.event || 'unknown';
    const email = payload?.email ? `${payload.email.slice(0, 2)}***` : 'unknown';
    this.logger.log(`Received Brevo webhook event: [${eventType}] for ${email}`);

    return { received: true };
  }
}
