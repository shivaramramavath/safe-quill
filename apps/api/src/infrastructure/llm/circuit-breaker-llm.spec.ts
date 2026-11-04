import { CircuitBreakerLlm } from './circuit-breaker-llm';
import { LlmPort } from '../../domain/ports/llm.port';

describe('CircuitBreakerLlm', () => {
  let circuitBreaker: CircuitBreakerLlm;
  let mockInner: jest.Mocked<LlmPort>;

  beforeEach(() => {
    mockInner = {
      rewrite: jest.fn(),
      analyzeTone: jest.fn(),
      generateSubjects: jest.fn(),
      explainGrammar: jest.fn(),
      summarize: jest.fn(),
      translate: jest.fn(),
      completeInline: jest.fn(),
    };
    circuitBreaker = new CircuitBreakerLlm(mockInner);
  });

  it('starts in CLOSED state and calls inner port', async () => {
    mockInner.rewrite.mockResolvedValueOnce({
      rewritten: 'Polished text',
      explanation: 'Done',
      provider: 'groq',
    });

    const res = await circuitBreaker.rewrite('Raw text', 'professional');
    expect(res.rewritten).toBe('Polished text');
    expect(circuitBreaker.getState()).toBe('CLOSED');
    expect(mockInner.rewrite).toHaveBeenCalledTimes(1);
  });

  it('Done when requirement: trips to OPEN after 3 consecutive failures and falls back without breaking', async () => {
    mockInner.rewrite.mockRejectedValue(new Error('Groq network timeout / down'));

    // Failure 1
    const res1 = await circuitBreaker.rewrite('High risk text', 'safe');
    expect(res1.provider).toBe('circuit-breaker-fallback');
    expect(circuitBreaker.getState()).toBe('CLOSED');

    // Failure 2
    await circuitBreaker.rewrite('High risk text', 'safe');
    expect(circuitBreaker.getState()).toBe('CLOSED');

    // Failure 3 -> Trips to OPEN!
    await circuitBreaker.rewrite('High risk text', 'safe');
    expect(circuitBreaker.getState()).toBe('OPEN');

    // 4th call: inner is NOT even called, fast circuit-breaker fallback is returned!
    const res4 = await circuitBreaker.rewrite('High risk text', 'safe');
    expect(res4.provider).toBe('circuit-breaker-fallback');
    expect(res4.rewritten).toContain('Regards');
    expect(mockInner.rewrite).toHaveBeenCalledTimes(3); // was not called a 4th time
  });
});
