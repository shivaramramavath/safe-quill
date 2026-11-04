import { Injectable, Logger } from '@nestjs/common';
import { RiskEvidence, RiskLevel } from '@safe-quill/shared';
import { HighRiskDetectedEvent } from '../events/analysis-events';

export interface ScorerInput {
  mlScore: number; // 0 - 100
  evidenceList: RiskEvidence[];
}

export interface ScorerResult {
  score: number; // 0 - 100
  level: RiskLevel;
  evidence: RiskEvidence[];
  isSpam: boolean;
  confidence: number;
  event?: HighRiskDetectedEvent;
}

/**
 * Composite Pattern: CompositeRiskScorer
 * Aggregates weighted evidence from multiple detector strategies and ML predictions.
 */
@Injectable()
export class CompositeRiskScorer {
  private readonly logger = new Logger(CompositeRiskScorer.name);

  // Detector category weights
  private static readonly WEIGHTS: Record<string, number> = {
    PromptInjectionDetector: 0.25,
    UrlAnalysisDetector: 0.20,
    BecPatternDetector: 0.20,
    SensitiveDataDetector: 0.15,
    SenderLookalikeDetector: 0.15,
    UrgencySocialEngineeringDetector: 0.10,
    HeaderAnalysisDetector: 0.10,
  };

  public calculateScore(input: ScorerInput): ScorerResult {
    const { mlScore, evidenceList } = input;

    let weightedSum = mlScore * 0.35;
    let totalWeight = 0.35;
    let maxSingleEvidenceScore = 0;

    for (const item of evidenceList) {
      const weight = CompositeRiskScorer.WEIGHTS[item.detectorName] || 0.10;
      weightedSum += item.score * weight;
      totalWeight += weight;
      maxSingleEvidenceScore = Math.max(maxSingleEvidenceScore, item.score);
    }

    let calculatedScore = Math.round(weightedSum / totalWeight);

    // Hard floor rule: If any detector flags critical severity (>= 85, such as direct wire fraud,
    // exposed passwords, homoglyph attack, or verified SSRF/phishing URL), the composite score
    // is guaranteed to reach at least 75 (HIGH risk).
    if (maxSingleEvidenceScore >= 85) {
      calculatedScore = Math.max(calculatedScore, 75);
    } else if (maxSingleEvidenceScore >= 70) {
      calculatedScore = Math.max(calculatedScore, 55);
    }

    // Clamp between 0 and 100
    calculatedScore = Math.min(100, Math.max(0, calculatedScore));

    const level: RiskLevel =
      calculatedScore >= 70 ? 'HIGH' : calculatedScore >= 40 ? 'MEDIUM' : 'LOW';
    const isSpam = calculatedScore >= 50;
    const confidence = calculatedScore >= 50 ? calculatedScore / 100 : (100 - calculatedScore) / 100;

    const finalEvidence = [...evidenceList];
    if (finalEvidence.length === 0 && calculatedScore >= 40) {
      finalEvidence.push({
        detectorName: 'UrgencySocialEngineeringDetector',
        level: calculatedScore >= 70 ? 'HIGH' : 'MEDIUM',
        score: calculatedScore,
        reason: `Statistical pattern classifier detected elevated risk indicators (${calculatedScore}/100) based on language style and token distribution.`,
      });
    }

    let event: HighRiskDetectedEvent | undefined;
    if (calculatedScore >= 70) {
      event = new HighRiskDetectedEvent(
        calculatedScore,
        finalEvidence.map((e) => e.reason),
      );
      this.logger.warn(`HIGH risk verdict detected: ${calculatedScore}/100 across ${finalEvidence.length} evidence points.`);
    }

    return {
      score: calculatedScore,
      level,
      evidence: finalEvidence,
      isSpam,
      confidence: Math.round(confidence * 100) / 100,
      event,
    };
  }
}
