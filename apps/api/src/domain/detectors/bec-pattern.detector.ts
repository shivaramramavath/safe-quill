import { Injectable } from '@nestjs/common';
import { BaseDetector, DetectionInput } from './base.detector';
import { RiskEvidence, UnderlineHighlight } from '@safe-quill/shared';

@Injectable()
export class BecPatternDetector extends BaseDetector {
  public override readonly name = 'BecPatternDetector';
  public override readonly description =
    'Identifies Business Email Compromise (BEC) fraud: wire fraud, gift card scams, payroll diversion, and CEO impersonation.';

  private static readonly BEC_TRIGGERS = [
    { pattern: /\b(wire\s+(transfer|payment|funds)|transfer\s+(funds|money)\s+to\s+(an?\s+)?(offshore|new|vendor)\s+account|swift\s+(code|transfer))\b/gi, score: 92, reason: 'BEC Wire Fraud: Urgent wire transfer request to external account' },
    { pattern: /\b(update|change)\s+(my\s+)?(direct\s+deposit|payroll\s+account|banking\s+details\s+for\s+payroll)\b/gi, score: 88, reason: 'Payroll Diversion: Attempts to divert salary direct deposits' },
    { pattern: /\b(buy|purchase|pick\s+up)\s+(\$\d+|\d+\s*dollars?\s+worth\s+of)?\s*(apple|google\s+play|itunes|steam|amazon|vanilla)\s+gift\s*cards?\b/gi, score: 95, reason: 'Gift Card Fraud: Classical CEO impersonation gift card solicitation' },
    { pattern: /\b(i\s+am\s+in\s+a\s+(board\s+)?meeting|do\s+not\s+call\s+me|strictly\s+confidential\s+acquisition|treat\s+this\s+as\s+confidential)\b/gi, score: 80, reason: 'Executive Isolation: Discourages verbal verification or claims executive confidentiality' },
  ];

  protected override async executeDetection(input: DetectionInput): Promise<RiskEvidence | null> {
    const text = input.combinedText;
    const underlines: UnderlineHighlight[] = [];
    const flaggedTokens: string[] = [];
    const reasons: string[] = [];
    let maxScore = 0;

    for (const trigger of BecPatternDetector.BEC_TRIGGERS) {
      const highlights = this.findOffsets(text, trigger.pattern, 'solid', trigger.reason);
      if (highlights.length > 0) {
        underlines.push(...highlights);
        flaggedTokens.push(...highlights.map((h) => h.text || 'bec_trigger'));
        maxScore = Math.max(maxScore, trigger.score);
        if (!reasons.includes(trigger.reason)) {
          reasons.push(trigger.reason);
        }
      }
    }

    if (underlines.length === 0) {
      return null;
    }

    const level = maxScore >= 70 ? 'HIGH' : maxScore >= 40 ? 'MEDIUM' : 'LOW';
    return this.createEvidence(
      level,
      maxScore,
      `Business Email Compromise (BEC): ${reasons.join('; ')}`,
      flaggedTokens,
      underlines,
    );
  }
}
