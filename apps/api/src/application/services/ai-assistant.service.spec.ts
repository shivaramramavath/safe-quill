import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiAssistantService } from './ai-assistant.service';
import { AnalysisPipeline } from '../pipeline/analysis.pipeline';
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
import { LLM_PORT } from '../../domain/ports/llm.port';
import { GroqAdapter } from '../../infrastructure/llm/groq.adapter';

describe('AiAssistantService Safe Rewrite & Score Reduction', () => {
  let service: AiAssistantService;

  beforeEach(async () => {
    const mockClassifier = {
      classify: jest.fn().mockImplementation(async (text: string) => {
        const isSpammy = text.toLowerCase().includes('wire funds') || text.toLowerCase().includes('suspended');
        return {
          label: isSpammy ? 'spam' : 'ham',
          confidence: 0.9,
          score: isSpammy ? 90 : 10,
          level: isSpammy ? 'HIGH' : 'LOW',
          topTokens: [],
          modelVersion: 'v1.0.0',
        };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAssistantService,
        AnalysisPipeline,
        DetectorFactory,
        CompositeRiskScorer,
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
            get: jest.fn().mockImplementation((k: string, def: any) => def),
          },
        },
        {
          provide: SPAM_CLASSIFIER_PORT,
          useValue: mockClassifier,
        },
        {
          provide: LLM_PORT,
          useClass: GroqAdapter,
        },
      ],
    }).compile();

    service = module.get<AiAssistantService>(AiAssistantService);
  });

  it('Done when requirement: a spammy email is safe-rewritten and the score visibly drops', async () => {
    const spamSample = {
      subject: 'URGENT: Suspended Account',
      body: 'Your account will be suspended within 24 hours. Wire funds to offshore account immediately at http://bit.ly/restore.',
      mode: 'safe' as const,
    };

    const response = await service.rewrite(spamSample);

    // Initial score was HIGH
    expect(response.originalScore).toBeGreaterThanOrEqual(75);
    expect(response.originalLevel).toBe('HIGH');

    // After Safe Rewrite: risk score visibly dropped!
    expect(response.newScore).toBeLessThan(40);
    expect(response.newLevel).toBe('LOW');
    expect(response.rewrittenText).not.toContain('http://bit.ly/restore');
    expect(response.explanation).toContain('Safe Rewrite');
  });
});
