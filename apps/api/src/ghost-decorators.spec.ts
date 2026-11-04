import { CircuitBreakerNextWordDecorator } from './infrastructure/ml/decorators/circuit-breaker-next-word.decorator';
import { RiskFilteredNextWordDecorator } from './infrastructure/ml/decorators/risk-filtered-next-word.decorator';
import { CachedNextWordDecorator } from './infrastructure/ml/decorators/cached-next-word.decorator';
import { RateLimitedNextWordDecorator } from './infrastructure/ml/decorators/rate-limited-next-word.decorator';
import { NextWordPort, NextWordSuggestion } from './domain/ports/next-word.port';
import { SpamClassifierPort, SpamClassifierResult } from './domain/ports/spam-classifier.port';
import { GhostTextService } from './application/services/ghost-text.service';
import { LlmPort } from './domain/ports/llm.port';

describe('Ghost Text Decorated Pipeline (Step 2)', () => {
  let mockPort: jest.Mocked<NextWordPort>;
  let mockClassifier: jest.Mocked<SpamClassifierPort>;
  let mockLlm: jest.Mocked<LlmPort>;

  beforeEach(() => {
    mockPort = {
      suggest: jest.fn(),
    };
    mockClassifier = {
      classify: jest.fn(),
    };
    mockLlm = {
      rewrite: jest.fn(),
      analyzeTone: jest.fn(),
      generateSubjects: jest.fn(),
      explainGrammar: jest.fn(),
      summarize: jest.fn(),
      translate: jest.fn(),
      completeInline: jest.fn(),
      generateDraft: jest.fn(),
      summarizeRich: jest.fn(),
      executeAction: jest.fn(),
    };
  });

  describe('CircuitBreakerNextWordDecorator', () => {
    it('returns empty list when ML service trips open after 3 consecutive failures', async () => {
      mockPort.suggest.mockRejectedValue(new Error('ML connection refused'));
      const circuit = new CircuitBreakerNextWordDecorator(mockPort);

      // 3 consecutive failures
      await circuit.suggest('context 1');
      await circuit.suggest('context 2');
      await circuit.suggest('context 3');

      expect(circuit.getState()).toBe('OPEN');

      // Subsequent query returns empty list without calling underlying port
      const result = await circuit.suggest('context 4');
      expect(result).toEqual([]);
      expect(mockPort.suggest).toHaveBeenCalledTimes(3);
    });

    it('returns suggestions and remains CLOSED on successful calls', async () => {
      mockPort.suggest.mockResolvedValue([{ completion: 'world', confidence: 0.9 }]);
      const circuit = new CircuitBreakerNextWordDecorator(mockPort);

      const result = await circuit.suggest('hello ');
      expect(result).toEqual([{ completion: 'world', confidence: 0.9 }]);
      expect(circuit.getState()).toBe('CLOSED');
    });
  });

  describe('RiskFilteredNextWordDecorator', () => {
    it('drops any suggestion when the current context is scored HIGH risk', async () => {
      mockClassifier.classify.mockResolvedValue({
        label: 'spam',
        confidence: 0.95,
        score: 85,
        level: 'HIGH',
        topTokens: [],
        modelVersion: 'v1.0.0',
      });
      mockPort.suggest.mockResolvedValue([{ completion: 'account verification', confidence: 0.8 }]);

      const filter = new RiskFilteredNextWordDecorator(mockPort, mockClassifier);
      const res = await filter.suggest('URGENT: Your account is suspended ');

      expect(res).toEqual([]);
      expect(mockPort.suggest).not.toHaveBeenCalled();
    });

    it('drops suggestions that elevate the score by more than 5 points', async () => {
      // Current context score: 20 (LOW)
      mockClassifier.classify.mockImplementation(async (text: string): Promise<SpamClassifierResult> => {
        if (text.includes('urgent wire transfer')) {
          // Score jump from 20 to 60 (+40 > 5)
          return { label: 'spam', confidence: 0.7, score: 60, level: 'MEDIUM', topTokens: [], modelVersion: 'v1' };
        }
        if (text.includes('our discussion')) {
          // Safe completion: score remains 21 (+1 <= 5)
          return { label: 'ham', confidence: 0.8, score: 21, level: 'LOW', topTokens: [], modelVersion: 'v1' };
        }
        return { label: 'ham', confidence: 0.8, score: 20, level: 'LOW', topTokens: [], modelVersion: 'v1' };
      });

      mockPort.suggest.mockResolvedValue([
        { completion: 'urgent wire transfer', confidence: 0.8 },
        { completion: 'our discussion', confidence: 0.75 },
      ]);

      const filter = new RiskFilteredNextWordDecorator(mockPort, mockClassifier);
      const res = await filter.suggest('As discussed in ');

      expect(res).toHaveLength(1);
      expect(res[0].completion).toBe('our discussion');
    });
  });

  describe('CachedNextWordDecorator', () => {
    it('returns cached suggestions on identical context without re-querying delegate', async () => {
      mockPort.suggest.mockResolvedValue([{ completion: 'back to you', confidence: 0.85 }]);
      const cached = new CachedNextWordDecorator(mockPort, null); // uses in-memory fallback

      const res1 = await cached.suggest('I will get ');
      expect(res1).toEqual([{ completion: 'back to you', confidence: 0.85 }]);
      expect(mockPort.suggest).toHaveBeenCalledTimes(1);

      // Identical context tail -> cache hit!
      const res2 = await cached.suggest('I will get ');
      expect(res2).toEqual([{ completion: 'back to you', confidence: 0.85 }]);
      expect(mockPort.suggest).toHaveBeenCalledTimes(1); // No second network call
    });
  });

  describe('RateLimitedNextWordDecorator', () => {
    it('silently throttles requests exceeding max limit per minute', async () => {
      mockPort.suggest.mockResolvedValue([{ completion: 'test', confidence: 0.5 }]);
      const limiter = new RateLimitedNextWordDecorator(mockPort, null);

      // Fire 60 requests (within limit)
      for (let i = 0; i < 60; i++) {
        await limiter.suggest('context', 3, { sessionId: 'test-session-1' });
      }
      expect(mockPort.suggest).toHaveBeenCalledTimes(60);

      // 61st request in the same minute -> throttled, returns []
      const throttledRes = await limiter.suggest('context', 3, { sessionId: 'test-session-1' });
      expect(throttledRes).toEqual([]);
      expect(mockPort.suggest).toHaveBeenCalledTimes(60);
    });
  });

  describe('GhostTextService with Tier (a) & Tier (b) Groq fallback', () => {
    it('falls back to Tier (a) local N-Gram when Groq fails', async () => {
      mockPort.suggest.mockResolvedValue([{ completion: 'know soon', confidence: 0.6 }]);
      mockLlm.completeInline.mockRejectedValue(new Error('Groq network down'));

      const service = new GhostTextService(mockPort, mockLlm);
      const res = await service.suggestNextWord({ context: 'Please let me ', allowLlmTier: true });

      expect(res.suggestions).toHaveLength(1);
      expect(res.suggestions[0].completion).toBe('know soon');
      expect(res.tier).toBe('local');
    });
  });
});
