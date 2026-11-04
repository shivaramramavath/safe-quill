import { Injectable } from '@nestjs/common';
import { BaseDetector, DetectionInput } from './base.detector';
import { RiskEvidence, UnderlineHighlight } from '@safe-quill/shared';

@Injectable()
export class UrgencySocialEngineeringDetector extends BaseDetector {
  public override readonly name = 'UrgencySocialEngineeringDetector';
  public override readonly description =
    'Detects artificial urgency, panic-inducing deadlines, and social-engineering coercion.';

  private static readonly URGENCY_TRIGGERS = [
    { pattern: /\b(within\s+(24|48|12|2|1)\s*(hours?|hrs?)|immediately|without\s+delay|at\s+once)\b/gi, score: 75, reason: 'Artificial deadline coercion' },
    { pattern: /\b(account\s+(will\s+be\s+)?(suspended|terminated|deleted|locked|blocked|frozen))\b/gi, score: 85, reason: 'Threat of immediate account loss' },
    { pattern: /\b(unauthorized\s+(access|transaction|login|activity|charges?))\b/gi, score: 80, reason: 'False security panic / alarmist claim' },
    { pattern: /\b(final\s+notice|last\s+warning|urgent\s+action\s+required|immediate\s+attention)\b/gi, score: 80, reason: 'Intimidation phrasing designed to bypass critical thinking' },
    { pattern: /\b(legal\s+action|lawsuit|arrest\s+warrant|police\s+notification|prosecution)\b/gi, score: 90, reason: 'Extreme authority threat coercion' },
    { pattern: /\b(act\s+now\s+or\s+lose|limited\s+time\s+to\s+claim|expires\s+today)\b/gi, score: 70, reason: 'Scarcity / FOMO psychological pressure' },
  ];

  protected override async executeDetection(input: DetectionInput): Promise<RiskEvidence | null> {
    const text = input.combinedText;
    const underlines: UnderlineHighlight[] = [];
    const flaggedTokens: string[] = [];
    const reasons: string[] = [];
    let maxScore = 0;

    for (const trigger of UrgencySocialEngineeringDetector.URGENCY_TRIGGERS) {
      const highlights = this.findOffsets(text, trigger.pattern, 'solid', trigger.reason);
      if (highlights.length > 0) {
        underlines.push(...highlights);
        flaggedTokens.push(...highlights.map((h) => h.text || 'urgency_cue'));
        maxScore = Math.max(maxScore, trigger.score);
        if (!reasons.includes(trigger.reason)) {
          reasons.push(trigger.reason);
        }
      }
    }

    if (underlines.length === 0) {
      return null;
    }

    // Cumulative urgency bonus if multiple coercion cues appear
    if (underlines.length >= 3) {
      maxScore = Math.min(100, maxScore + 10);
    }

    const level = maxScore >= 70 ? 'HIGH' : maxScore >= 40 ? 'MEDIUM' : 'LOW';
    return this.createEvidence(
      level,
      maxScore,
      `Urgency & Social Engineering Cues: ${reasons.join('; ')}`,
      flaggedTokens,
      underlines,
    );
  }
}
