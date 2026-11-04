import { Logger } from '@nestjs/common';
import {
  NextWordPort,
  NextWordSuggestion,
  NextWordOptions,
} from '../../../domain/ports/next-word.port';
import { SpamClassifierPort } from '../../../domain/ports/spam-classifier.port';

const SENSITIVE_WORDS_REGEX = /\b(password|otp|pin|cvv|account\s+number|bank|wire|transfer|gift\s+card|click|verify|ssn)\b/i;
const SENSITIVE_PATTERN_REGEX = /https?:\/\/|\b\d{4,}\b|@/i;

export class RiskFilteredNextWordDecorator implements NextWordPort {
  private readonly logger = new Logger(RiskFilteredNextWordDecorator.name);

  constructor(
    private readonly delegate: NextWordPort,
    private readonly classifier: SpamClassifierPort,
  ) {}

  public async suggest(
    context: string,
    topK = 3,
    options?: NextWordOptions,
  ): Promise<NextWordSuggestion[]> {
    if (!context || !context.trim()) {
      return [];
    }

    try {
      // 1. Check current context risk
      const currentRes = await this.classifier.classify(context);
      if (currentRes.level === 'HIGH') {
        // Never suggest when current text is scored HIGH risk
        return [];
      }

      // 2. Query candidates from underlying port/adapter
      const candidates = await this.delegate.suggest(context, topK, options);
      if (!candidates || candidates.length === 0) {
        return [];
      }

      const safeSuggestions: NextWordSuggestion[] = [];

      for (const cand of candidates) {
        // 3. Reject if containing sensitive words, links, or numbers
        if (
          SENSITIVE_WORDS_REGEX.test(cand.completion) ||
          SENSITIVE_PATTERN_REGEX.test(cand.completion)
        ) {
          continue;
        }

        // 4. Verify candidate doesn't elevate risk score by > 5 points
        try {
          const augmentedText = context + cand.completion;
          const augmentedRes = await this.classifier.classify(augmentedText);

          if (augmentedRes.score > currentRes.score + 5) {
            this.logger.debug(
              `Dropped suggestion elevating score: +${augmentedRes.score - currentRes.score}`,
            );
            continue;
          }

          safeSuggestions.push(cand);
        } catch {
          // If classification fails, allow only if candidate text looks benign
          if (!cand.completion.includes('http')) {
            safeSuggestions.push(cand);
          }
        }
      }

      return safeSuggestions;
    } catch {
      return [];
    }
  }
}
