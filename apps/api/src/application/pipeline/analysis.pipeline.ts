import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  RiskAnalysisResult,
  RiskEvidence,
  TokenWeight,
} from '@safe-quill/shared';
import {
  SPAM_CLASSIFIER_PORT,
  SpamClassifierPort,
} from '../../domain/ports/spam-classifier.port';
import { DetectorFactory } from '../../domain/detectors/detector.factory';
import { DetectionInput } from '../../domain/detectors/base.detector';
import { CompositeRiskScorer } from '../../domain/scoring/composite-risk.scorer';

export interface PipelinePayload {
  subject?: string;
  body: string;
  rawHeaders?: string;
}

@Injectable()
export class AnalysisPipeline {
  private readonly logger = new Logger(AnalysisPipeline.name);

  constructor(
    @Inject(SPAM_CLASSIFIER_PORT)
    private readonly spamClassifier: SpamClassifierPort,
    private readonly detectorFactory: DetectorFactory,
    private readonly riskScorer: CompositeRiskScorer,
  ) {}

  public async run(payload: PipelinePayload): Promise<Omit<RiskAnalysisResult, 'latencyMs' | 'cached'>> {
    // 1. Sanitize step: normalize input and combine subject + body
    const sanitizedSubject = (payload.subject || '').replace(/\0/g, '').trim();
    const sanitizedBody = (payload.body || '').replace(/\0/g, '').trim();
    const combinedText = [sanitizedSubject, sanitizedBody].filter(Boolean).join('\n\n');

    if (!combinedText) {
      return {
        score: 0,
        level: 'LOW',
        isSpam: false,
        confidence: 0,
        evidence: [],
        topTokens: [],
        modelVersion: 'v1.0.0',
      };
    }

    const detectionInput: DetectionInput = {
      subject: sanitizedSubject,
      body: sanitizedBody,
      rawHeaders: payload.rawHeaders,
      combinedText,
    };

    // 2. Run All Security Detectors via DetectorFactory (Chain of Responsibility)
    const detectors = this.detectorFactory.getDetectors();
    const evidenceList: RiskEvidence[] = [];

    for (const detector of detectors) {
      const { evidence } = await detector.detect(detectionInput);
      if (evidence) {
        evidenceList.push(evidence);
      }
    }

    // 3. ML Spam Classification step
    const mlResult = await this.spamClassifier.classify(combinedText);
    const topTokens: TokenWeight[] = mlResult.topTokens || [];

    // 4. Composite Scoring step
    const scoring = this.riskScorer.calculateScore({
      mlScore: mlResult.score,
      evidenceList,
    });

    return {
      score: scoring.score,
      level: scoring.level,
      isSpam: scoring.isSpam,
      confidence: scoring.confidence,
      evidence: scoring.evidence,
      topTokens,
      modelVersion: mlResult.modelVersion,
    };
  }
}
