import { Logger } from '@nestjs/common';
import {
  NextWordPort,
  NextWordSuggestion,
  NextWordOptions,
} from '../../../domain/ports/next-word.port';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreakerNextWordDecorator implements NextWordPort {
  private readonly logger = new Logger(CircuitBreakerNextWordDecorator.name);
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 3;
  private readonly recoveryTimeoutMs = 30000; // 30s open window

  constructor(private readonly delegate: NextWordPort) {}

  public async suggest(
    context: string,
    topK = 3,
    options?: NextWordOptions,
  ): Promise<NextWordSuggestion[]> {
    const now = Date.now();

    // Check if recovery window elapsed
    if (this.state === 'OPEN') {
      if (now - this.lastFailureTime > this.recoveryTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.logger.log('Circuit breaker half-open: probing next-word ML service...');
      } else {
        // Return empty list silently (no errors in UI)
        return [];
      }
    }

    try {
      const result = await this.delegate.suggest(context, topK, options);

      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.logger.log('Circuit breaker closed: ML next-word service recovered.');
      }

      this.failureCount = 0;
      return result;
    } catch {
      this.failureCount++;
      this.lastFailureTime = now;

      if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
        this.state = 'OPEN';
        this.logger.warn(
          `Circuit breaker OPEN: Next-word service failing (${this.failureCount} errors). Tripping for 30s.`,
        );
      }

      // Never throw, return empty list
      return [];
    }
  }

  public getState(): CircuitState {
    return this.state;
  }
}
