export const NEXT_WORD_PORT = Symbol('NextWordPort');

export interface NextWordSuggestion {
  completion: string;
  confidence: number;
  tier?: 'local' | 'groq';
}

export interface NextWordOptions {
  sessionId?: string;
  allowLlmTier?: boolean;
}

export interface NextWordPort {
  suggest(
    context: string,
    topK?: number,
    options?: NextWordOptions,
  ): Promise<NextWordSuggestion[]>;
}
