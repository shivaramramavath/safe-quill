import { performance } from 'perf_hooks';
import { Logger } from '@nestjs/common';
import { RiskEvidence, RiskLevel, UnderlineHighlight } from '@safe-quill/shared';

export interface DetectionInput {
  subject?: string;
  body: string;
  rawHeaders?: string;
  combinedText: string;
}

export interface DetectorExecutionResult {
  evidence: RiskEvidence | null;
  latencyMs: number;
}

/**
 * Template Method Pattern: BaseDetector
 * Enforces execution timing, robust error isolation (a failing detector never breaks the pipeline),
 * and standardized RiskEvidence result structure.
 */
export abstract class BaseDetector {
  protected readonly logger = new Logger(this.constructor.name);

  public abstract readonly name: string;
  public abstract readonly description: string;

  /**
   * Template Method - orchestrates execution, timing, and error isolation.
   */
  public async detect(input: DetectionInput): Promise<DetectorExecutionResult> {
    const startTime = performance.now();

    try {
      const evidence = await this.executeDetection(input);
      const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
      return { evidence, latencyMs };
    } catch (err: any) {
      const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
      this.logger.warn(`Detector ${this.name} failed (${err.message}) after ${latencyMs}ms. Isolated successfully.`);
      return { evidence: null, latencyMs };
    }
  }

  /**
   * Subclasses implement their specific detection logic here.
   */
  protected abstract executeDetection(input: DetectionInput): Promise<RiskEvidence | null>;

  /**
   * Helper to format standardized RiskEvidence
   */
  protected createEvidence(
    level: RiskLevel,
    score: number,
    reason: string,
    flaggedTokens: string[] = [],
    underlines: UnderlineHighlight[] = [],
  ): RiskEvidence {
    return {
      detectorName: this.name,
      level,
      score,
      reason,
      flaggedTokens,
      underlines,
    };
  }

  /**
   * Helper to locate underline offsets in body or subject
   */
  protected findOffsets(
    text: string,
    pattern: RegExp,
    type: 'solid' | 'dashed' | 'wavy',
    reason: string,
  ): UnderlineHighlight[] {
    const highlights: UnderlineHighlight[] = [];
    const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      highlights.push({
        start: match.index,
        end: match.index + match[0].length,
        type,
        reason,
        text: match[0],
      });
      if (!pattern.flags.includes('g')) break;
    }

    return highlights;
  }
}
