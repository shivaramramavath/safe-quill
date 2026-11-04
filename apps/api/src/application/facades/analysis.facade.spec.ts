import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AnalysisFacade } from './analysis.facade';
import { SPAM_CLASSIFIER_PORT, SpamClassifierPort } from '../../domain/ports/spam-classifier.port';
import { ContentHashCacheService } from '../../infrastructure/cache/content-hash-cache.service';

describe('AnalysisFacade', () => {
  let facade: AnalysisFacade;
  let mockClassifier: jest.Mocked<SpamClassifierPort>;

  beforeEach(async () => {
    mockClassifier = {
      classify: jest.fn().mockResolvedValue({
        label: 'spam',
        confidence: 0.94,
        score: 94,
        level: 'HIGH',
        topTokens: [{ token: 'urgent', weight: 0.85 }],
        modelVersion: 'v1.0.0',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysisFacade,
        ContentHashCacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def: any) => def),
          },
        },
        {
          provide: SPAM_CLASSIFIER_PORT,
          useValue: mockClassifier,
        },
      ],
    }).compile();

    facade = module.get<AnalysisFacade>(AnalysisFacade);
  });

  it('classifies text on initial call and returns cached: false', async () => {
    const res = await facade.analyze({
      subject: 'Urgent notice',
      body: 'Your account is suspended. Click to verify.',
    });

    expect(mockClassifier.classify).toHaveBeenCalledTimes(1);
    expect(res.label).toBe('spam');
    expect(res.score).toBe(94);
    expect(res.level).toBe('HIGH');
    expect(res.cached).toBe(false);
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('Done when requirement: identical text immediately hits the cache', async () => {
    const input = {
      subject: 'Security Alert',
      body: 'Someone accessed your password from an unauthorized device.',
    };

    // First call (cache miss)
    const firstRes = await facade.analyze(input);
    expect(firstRes.cached).toBe(false);
    expect(mockClassifier.classify).toHaveBeenCalledTimes(1);

    // Second call with identical text (cache hit!)
    const secondRes = await facade.analyze(input);
    expect(secondRes.cached).toBe(true);
    expect(secondRes.score).toBe(firstRes.score);
    expect(secondRes.label).toBe(firstRes.label);
    // Classifier was NOT called again
    expect(mockClassifier.classify).toHaveBeenCalledTimes(1);
  });

  it('returns clean zero state for empty text', async () => {
    const res = await facade.analyze({
      subject: '',
      body: '   ',
    });

    expect(mockClassifier.classify).not.toHaveBeenCalled();
    expect(res.score).toBe(0);
    expect(res.label).toBe('ham');
    expect(res.level).toBe('LOW');
  });
});
