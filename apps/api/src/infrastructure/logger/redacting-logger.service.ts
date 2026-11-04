import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';

@Injectable()
export class RedactingLogger extends ConsoleLogger {
  private static readonly SENSITIVE_PATTERNS = [
    /"body"\s*:\s*".*?"/gis,
    /"subject"\s*:\s*".*?"/gis,
    /"rawHeaders"\s*:\s*".*?"/gis,
  ];

  override log(message: any, ...optionalParams: any[]) {
    super.log(this.redact(message), ...this.redactParams(optionalParams));
  }

  override error(message: any, stack?: string, context?: string) {
    super.error(this.redact(message), this.redact(stack), context);
  }

  override warn(message: any, ...optionalParams: any[]) {
    super.warn(this.redact(message), ...this.redactParams(optionalParams));
  }

  override debug(message: any, ...optionalParams: any[]) {
    super.debug(this.redact(message), ...this.redactParams(optionalParams));
  }

  override verbose(message: any, ...optionalParams: any[]) {
    super.verbose(this.redact(message), ...this.redactParams(optionalParams));
  }

  private redact(input: any): any {
    if (typeof input !== 'string') {
      if (input && typeof input === 'object') {
        try {
          const cloned = { ...input };
          if ('body' in cloned) cloned.body = '[REDACTED_CONTENT]';
          if ('subject' in cloned) cloned.subject = '[REDACTED_SUBJECT]';
          if ('rawHeaders' in cloned) cloned.rawHeaders = '[REDACTED_HEADERS]';
          return JSON.stringify(cloned);
        } catch {
          return input;
        }
      }
      return input;
    }

    let sanitized = input;
    for (const pattern of RedactingLogger.SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '"[REDACTED_CONTENT]"');
    }
    return sanitized;
  }

  private redactParams(params: any[]): any[] {
    return params.map((p) => this.redact(p));
  }
}
