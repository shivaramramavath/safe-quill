export interface AttachmentInfo {
  filename: string;
  mimeType: string;
  sizeBytes?: number;
  sha256?: string;
  isBlocked?: boolean;
}

export interface EmlParseResult {
  subject: string;
  from?: string;
  to?: string;
  date?: string;
  body: string;
  rawHeaders: string;
  attachments: AttachmentInfo[];
  detectedQrCodes?: string[];
}

export interface AnalyzeEmlRequest {
  emlContent: string;
}

export interface ExportResponse {
  format: 'txt' | 'eml' | 'json';
  filename: string;
  contentType: string;
  content: string;
}
