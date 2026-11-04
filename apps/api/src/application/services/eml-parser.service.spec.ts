import { EmlParserService } from './eml-parser.service';

describe('EmlParserService', () => {
  let parser: EmlParserService;

  beforeEach(() => {
    parser = new EmlParserService();
  });

  it('should parse simple RFC 822 email headers and body', () => {
    const rawEml = [
      'From: ceo@company.com',
      'To: finance@company.com',
      'Subject: Urgent Wire Request',
      'Date: Wed, 04 Nov 2026 21:00:00 GMT',
      '',
      'Please process an urgent wire transfer to offshore account.',
    ].join('\r\n');

    const result = parser.parse(rawEml);
    expect(result.subject).toBe('Urgent Wire Request');
    expect(result.from).toBe('ceo@company.com');
    expect(result.body).toContain('wire transfer');
    expect(result.attachments).toHaveLength(0);
  });

  it('should parse MIME multipart email with attachments and calculate SHA-256 hash', () => {
    const boundary = '----=_Part_12345';
    const rawEml = [
      'From: billing@phish-portal.com',
      'Subject: Overdue Invoice Notice',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Dear Customer, please find your overdue invoice attached.',
      `--${boundary}`,
      'Content-Type: application/octet-stream; name="invoice_details.pdf.exe"',
      'Content-Disposition: attachment; filename="invoice_details.pdf.exe"',
      '',
      'MZ9000fakebinarypayloadhere',
      `--${boundary}--`,
    ].join('\r\n');

    const result = parser.parse(rawEml);
    expect(result.subject).toBe('Overdue Invoice Notice');
    expect(result.body).toContain('overdue invoice attached');
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].filename).toBe('invoice_details.pdf.exe');
    expect(result.attachments[0].sha256).toBeDefined();
    expect(result.attachments[0].sha256).toHaveLength(64);
  });
});
