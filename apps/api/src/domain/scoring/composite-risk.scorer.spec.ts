import { CompositeRiskScorer } from './composite-risk.scorer';

describe('CompositeRiskScorer', () => {
  const scorer = new CompositeRiskScorer();

  it('calculates weighted score and emits event when HIGH risk', () => {
    const result = scorer.calculateScore({
      mlScore: 80,
      evidenceList: [
        {
          detectorName: 'BecPatternDetector',
          level: 'HIGH',
          score: 95,
          reason: 'BEC Wire Fraud',
        },
        {
          detectorName: 'UrgencySocialEngineeringDetector',
          level: 'HIGH',
          score: 85,
          reason: 'Artificial deadline coercion',
        },
      ],
    });

    expect(result.level).toBe('HIGH');
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.isSpam).toBe(true);
    expect(result.event).toBeDefined();
    expect(result.event!.score).toBe(result.score);
  });

  it('calculates LOW risk for benign messages with 0 evidence', () => {
    const result = scorer.calculateScore({
      mlScore: 10,
      evidenceList: [],
    });

    expect(result.level).toBe('LOW');
    expect(result.score).toBeLessThan(40);
    expect(result.isSpam).toBe(false);
    expect(result.event).toBeUndefined();
  });

  it('guarantees floor score >= 75 if any detector flags critical severity >= 85', () => {
    const result = scorer.calculateScore({
      mlScore: 20, // Even if ML model gave low score
      evidenceList: [
        {
          detectorName: 'UrlAnalysisDetector',
          level: 'HIGH',
          score: 95, // But a critical SSRF or credential phishing URL was verified
          reason: 'SSRF attempt: URL targets internal metadata',
        },
      ],
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.level).toBe('HIGH');
  });
});
