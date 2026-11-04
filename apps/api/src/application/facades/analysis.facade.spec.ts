import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AnalysisFacade } from './analysis.facade';
import { AnalysisPipeline } from '../pipeline/analysis.pipeline';
import { ContentHashCacheService } from '../../infrastructure/cache/content-hash-cache.service';
import { DetectorFactory } from '../../domain/detectors/detector.factory';
import { PromptInjectionDetector } from '../../domain/detectors/prompt-injection.detector';
import { UrlAnalysisDetector } from '../../domain/detectors/url-analysis.detector';
import { SenderLookalikeDetector } from '../../domain/detectors/sender-lookalike.detector';
import { HeaderAnalysisDetector } from '../../domain/detectors/header-analysis.detector';
import { UrgencySocialEngineeringDetector } from '../../domain/detectors/urgency-social-engineering.detector';
import { SensitiveDataDetector } from '../../domain/detectors/sensitive-data.detector';
import { BecPatternDetector } from '../../domain/detectors/bec-pattern.detector';
import { CompositeRiskScorer } from '../../domain/scoring/composite-risk.scorer';
import { SPAM_CLASSIFIER_PORT } from '../../domain/ports/spam-classifier.port';

describe('AnalysisFacade with Detector Pipeline', () => {
  let facade: AnalysisFacade;
  let mockClassifier: any;

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
        AnalysisPipeline,
        DetectorFactory,
        CompositeRiskScorer,
        ContentHashCacheService,
        PromptInjectionDetector,
        UrlAnalysisDetector,
        SenderLookalikeDetector,
        HeaderAnalysisDetector,
        UrgencySocialEngineeringDetector,
        SensitiveDataDetector,
        BecPatternDetector,
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

  it('runs entire pipeline and returns HIGH risk for phishing sample with evidence', async () => {
    const res = await facade.analyze({
      subject: 'URGENT: Suspicious activity on your account',
      body: 'Your account will be suspended within 24 hours. Wire funds to offshore account or verify at http://169.254.169.254/login immediately.',
    });

    expect(res.level).toBe('HIGH');
    expect(res.score).toBeGreaterThanOrEqual(75);
    expect(res.isSpam).toBe(true);
    expect(res.evidence.length).toBeGreaterThan(0);
    expect(res.cached).toBe(false);
  });

  it('caches results on identical text and returns cached: true', async () => {
    const input = {
      subject: 'Weekly Team Meeting',
      body: 'Hey team, here are the meeting notes for our project sync.',
    };

    const first = await facade.analyze(input);
    expect(first.cached).toBe(false);

    const second = await facade.analyze(input);
    expect(second.cached).toBe(true);
    expect(second.score).toBe(first.score);
  });
});
