import { Injectable } from '@nestjs/common';
import { BaseDetector, DetectionInput } from './base.detector';
import { RiskEvidence, UnderlineHighlight } from '@safe-quill/shared';

@Injectable()
export class SensitiveDataDetector extends BaseDetector {
  public override readonly name = 'SensitiveDataDetector';
  public override readonly description =
    'Detects sensitive data exposure (Credit Cards via Luhn, SSNs, API keys) and phishing requests for credentials.';

  private static readonly SSN_REGEX = /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g;

  private static readonly API_KEY_PATTERNS = [
    { pattern: /\b(gsk_[a-zA-Z0-9]{32,})\b/g, name: 'Groq API Key' },
    { pattern: /\b(sk_live_[a-zA-Z0-9]{24,})\b/g, name: 'Stripe Secret Key' },
    { pattern: /\b(ghp_[a-zA-Z0-9]{36})\b/g, name: 'GitHub Personal Access Token' },
    { pattern: /\b(AKIA[0-9A-Z]{16})\b/g, name: 'AWS Access Key ID' },
  ];

  private static readonly CREDENTIAL_REQUEST_PATTERNS = [
    { pattern: /\b(reply|send|provide|submit)\s+(with\s+)?(your\s+)?(passwords?|passcode|pin\s+number|2fa\s+code|otp)\b/gi, score: 95, reason: 'Explicit request for confidential passwords or 2FA codes' },
    { pattern: /\b(enter|confirm|verify)\s+(your\s+)?(credit\s+card|banking|ssn|social\s+security)\s+(number|details)\b/gi, score: 90, reason: 'Phishing prompt demanding financial credentials' },
  ];

  protected override async executeDetection(input: DetectionInput): Promise<RiskEvidence | null> {
    const text = input.combinedText;
    const underlines: UnderlineHighlight[] = [];
    const flaggedTokens: string[] = [];
    const reasons: string[] = [];
    let maxScore = 0;

    // 1. Phishing requests for passwords / credentials
    for (const item of SensitiveDataDetector.CREDENTIAL_REQUEST_PATTERNS) {
      const highlights = this.findOffsets(text, item.pattern, 'wavy', item.reason);
      if (highlights.length > 0) {
        underlines.push(...highlights);
        flaggedTokens.push(...highlights.map((h) => h.text || 'credential_prompt'));
        maxScore = Math.max(maxScore, item.score);
        if (!reasons.includes(item.reason)) reasons.push(item.reason);
      }
    }

    // 2. SSN Detection
    const ssnHighlights = this.findOffsets(text, SensitiveDataDetector.SSN_REGEX, 'wavy', 'Exposed Social Security Number');
    if (ssnHighlights.length > 0) {
      underlines.push(...ssnHighlights);
      flaggedTokens.push('[REDACTED_SSN]');
      maxScore = Math.max(maxScore, 90);
      reasons.push('Sensitive PII exposure: Social Security Number (SSN)');
    }

    // 3. API Keys
    for (const keyItem of SensitiveDataDetector.API_KEY_PATTERNS) {
      const keyHighlights = this.findOffsets(text, keyItem.pattern, 'wavy', `Exposed ${keyItem.name}`);
      if (keyHighlights.length > 0) {
        underlines.push(...keyHighlights);
        flaggedTokens.push(`[REDACTED_${keyItem.name.toUpperCase().replace(/\s+/g, '_')}]`);
        maxScore = Math.max(maxScore, 95);
        reasons.push(`High-severity secret leak: ${keyItem.name}`);
      }
    }

    // 4. Credit Card Detection via Luhn algorithm
    const ccCandidateRegex = /\b(?:\d[ -]*?){13,19}\b/g;
    let ccMatch: RegExpExecArray | null;
    while ((ccMatch = ccCandidateRegex.exec(text)) !== null) {
      const cleaned = ccMatch[0].replace(/[\s-]/g, '');
      if (cleaned.length >= 13 && cleaned.length <= 19 && this.luhnCheck(cleaned)) {
        underlines.push({
          start: ccMatch.index,
          end: ccMatch.index + ccMatch[0].length,
          type: 'wavy',
          reason: 'Valid Credit Card number format detected',
          text: '[REDACTED_CARD]',
        });
        flaggedTokens.push('[REDACTED_CARD]');
        maxScore = Math.max(maxScore, 92);
        if (!reasons.includes('Payment card data exposure (Luhn verified)')) {
          reasons.push('Payment card data exposure (Luhn verified)');
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
      `Sensitive Data Warning: ${reasons.join('; ')}`,
      flaggedTokens,
      underlines,
    );
  }

  private luhnCheck(numStr: string): boolean {
    let sum = 0;
    let isEven = false;
    for (let i = numStr.length - 1; i >= 0; i--) {
      let digit = parseInt(numStr.charAt(i), 10);
      if (isNaN(digit)) return false;
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isEven = !isEven;
    }
    return sum % 10 === 0;
  }
}
