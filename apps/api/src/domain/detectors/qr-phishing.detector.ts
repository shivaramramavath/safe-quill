import { Injectable } from '@nestjs/common';
import { BaseDetector, DetectionInput } from './base.detector';
import { RiskEvidence, UnderlineHighlight } from '@safe-quill/shared';

@Injectable()
export class QrPhishingDetector extends BaseDetector {
  public override readonly name = 'QrPhishingDetector';
  public override readonly description =
    'Detects QR code phishing ("Quishing") cues designed to bypass email URL gateways and divert targets to unmonitored mobile browsers.';

  private static readonly QUISHING_TRIGGERS = [
    {
      pattern: /\b(scan\s+(the\s+)?(qr\s+code|code\s+below|barcode)\s+(with\s+your\s+phone|camera|authenticator|mobile))\b/gi,
      score: 88,
      reason: 'Explicit QR code scan diversion instruction ("Quishing")',
    },
    {
      pattern: /\b(scan\s+(the\s+)?qr\s+code\s+to\s+(verify|authenticate|login|access|update|renew|review))\b/gi,
      score: 85,
      reason: 'QR code credential harvesting or 2FA bypass coercion',
    },
    {
      pattern: /\b(qr\s+code\s+(will\s+expire|is\s+only\s+valid|expires\s+in))\b/gi,
      score: 82,
      reason: 'Urgent expiration coercion applied to a QR code',
    },
    {
      pattern: /\b(cid:[\w.-]*qr[\w.-]*|\[qr\s*code\s*image\])\b/gi,
      score: 80,
      reason: 'Embedded QR code image reference',
    },
  ];

  protected override async executeDetection(input: DetectionInput): Promise<RiskEvidence | null> {
    const text = `${input.combinedText}\n${input.rawHeaders || ''}`;
    const underlines: UnderlineHighlight[] = [];
    const flaggedTokens: string[] = [];
    const reasons: string[] = [];
    let maxScore = 0;

    for (const trigger of QrPhishingDetector.QUISHING_TRIGGERS) {
      const hits = this.findOffsets(text, trigger.pattern, 'wavy', trigger.reason);
      if (hits.length > 0) {
        underlines.push(...hits);
        flaggedTokens.push(...hits.map((h) => h.text || 'quishing_cue'));
        maxScore = Math.max(maxScore, trigger.score);
        if (!reasons.includes(trigger.reason)) {
          reasons.push(trigger.reason);
        }
      }
    }

    if (underlines.length === 0) {
      return null;
    }

    // Cumulative severity if scan prompt is paired with credential or 2FA claims
    if (/(\bmfa\b|\b2fa\b|\bpassword\b|\bauthenticator\b|\bpayroll\b)/i.test(text)) {
      maxScore = Math.min(100, maxScore + 7);
      reasons.push('Quishing target paired with sensitive credential or authenticator lures');
    }

    const level = maxScore >= 70 ? 'HIGH' : maxScore >= 40 ? 'MEDIUM' : 'LOW';
    return this.createEvidence(
      level,
      maxScore,
      reasons.join('; '),
      Array.from(new Set(flaggedTokens)),
      underlines,
    );
  }
}
