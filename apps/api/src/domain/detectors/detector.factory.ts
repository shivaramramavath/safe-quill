import { Injectable } from '@nestjs/common';
import { BaseDetector } from './base.detector';
import { PromptInjectionDetector } from './prompt-injection.detector';
import { UrlAnalysisDetector } from './url-analysis.detector';
import { SenderLookalikeDetector } from './sender-lookalike.detector';
import { HeaderAnalysisDetector } from './header-analysis.detector';
import { UrgencySocialEngineeringDetector } from './urgency-social-engineering.detector';
import { SensitiveDataDetector } from './sensitive-data.detector';
import { BecPatternDetector } from './bec-pattern.detector';

@Injectable()
export class DetectorFactory {
  private readonly detectors: BaseDetector[];

  constructor(
    promptInjection: PromptInjectionDetector,
    urlAnalysis: UrlAnalysisDetector,
    senderLookalike: SenderLookalikeDetector,
    headerAnalysis: HeaderAnalysisDetector,
    urgency: UrgencySocialEngineeringDetector,
    sensitiveData: SensitiveDataDetector,
    becPattern: BecPatternDetector,
  ) {
    this.detectors = [
      promptInjection,
      urlAnalysis,
      senderLookalike,
      headerAnalysis,
      urgency,
      sensitiveData,
      becPattern,
    ];
  }

  /**
   * Returns all active detector strategies.
   */
  public getDetectors(): BaseDetector[] {
    return [...this.detectors];
  }

  /**
   * Register a new detector without modifying existing pipeline logic (Open/Closed).
   */
  public registerDetector(detector: BaseDetector): void {
    this.detectors.push(detector);
  }
}
