import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { AttachmentInfo, EmlParseResult } from '@safe-quill/shared';

@Injectable()
export class EmlParserService {
  private readonly logger = new Logger(EmlParserService.name);

  parse(rawEml: string): EmlParseResult {
    const normalized = rawEml.replace(/\r\n/g, '\n');
    const headerBodySplit = normalized.indexOf('\n\n');

    let headerSection = '';
    let bodySection = '';

    if (headerBodySplit === -1) {
      headerSection = '';
      bodySection = normalized;
    } else {
      headerSection = normalized.slice(0, headerBodySplit);
      bodySection = normalized.slice(headerBodySplit + 2);
    }

    // Extract standard RFC 822 headers
    const subject = this.extractHeader(headerSection, 'Subject') || 'Untitled Email';
    const from = this.extractHeader(headerSection, 'From');
    const to = this.extractHeader(headerSection, 'To');
    const date = this.extractHeader(headerSection, 'Date') || new Date().toISOString();

    // Check for MIME boundary
    const contentType = this.extractHeader(headerSection, 'Content-Type');
    const boundaryMatch = contentType?.match(/boundary=["']?([^"';]+)["']?/i);

    const attachments: AttachmentInfo[] = [];
    const qrCodes: string[] = [];
    let cleanBody = '';

    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const parts = bodySection.split(`--${boundary}`);

      for (const part of parts) {
        if (!part || part.trim() === '--') continue;

        const partSplit = part.indexOf('\n\n');
        const partHeaders = partSplit !== -1 ? part.slice(0, partSplit) : '';
        const partContent = partSplit !== -1 ? part.slice(partSplit + 2).trim() : part.trim();

        const partDisposition = this.extractHeader(partHeaders, 'Content-Disposition');
        const partType = this.extractHeader(partHeaders, 'Content-Type') || 'text/plain';

        const filenameMatch =
          (partDisposition && partDisposition.match(/filename=["']?([^"';\n]+)["']?/i)) ||
          partType.match(/name=["']?([^"';\n]+)["']?/i);

        if (filenameMatch) {
          const filename = filenameMatch[1].trim();
          const sha256 = crypto.createHash('sha256').update(partContent).digest('hex');
          attachments.push({
            filename,
            mimeType: partType.split(';')[0].trim(),
            sizeBytes: Buffer.byteLength(partContent, 'utf-8'),
            sha256,
          });

          if (/qr[-_]?code|\.qr\./i.test(filename)) {
            qrCodes.push(filename);
          }
        } else if (partType.toLowerCase().includes('text/plain') && !cleanBody) {
          cleanBody = partContent;
        } else if (partType.toLowerCase().includes('text/html') && !cleanBody) {
          cleanBody = this.stripHtml(partContent);
        }
      }
    } else {
      cleanBody = contentType?.includes('text/html') ? this.stripHtml(bodySection) : bodySection;
    }

    // Inspect cleanBody for quishing clues
    if (/(\bqr[-_]?code\b|scan\s+(the\s+)?code)/i.test(cleanBody)) {
      qrCodes.push('embedded-qr-code-prompt');
    }

    return {
      subject,
      from,
      to,
      date,
      body: cleanBody.trim(),
      rawHeaders: headerSection.trim(),
      attachments,
      detectedQrCodes: qrCodes,
    };
  }

  private extractHeader(headerText: string, headerName: string): string | undefined {
    const regex = new RegExp(`^${headerName}:\\s*(.+)$`, 'im');
    const match = headerText.match(regex);
    return match ? match[1].trim() : undefined;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
