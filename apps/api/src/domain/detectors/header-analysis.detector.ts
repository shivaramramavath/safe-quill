import { Injectable } from '@nestjs/common';
import { BaseDetector, DetectionInput } from './base.detector';
import { RiskEvidence, UnderlineHighlight } from '@safe-quill/shared';

@Injectable()
export class HeaderAnalysisDetector extends BaseDetector {
  public override readonly name = 'HeaderAnalysisDetector';
  public override readonly description =
    'Evaluates SPF, DKIM, and DMARC authentication verdicts, and flags From vs Reply-To mismatches.';

  protected override async executeDetection(input: DetectionInput): Promise<RiskEvidence | null> {
    const rawHeaders = (input.rawHeaders || '') + '\n' + (input.combinedText.includes('Received:') ? input.combinedText : '');

    if (!rawHeaders.trim()) {
      return null;
    }

    const reasons: string[] = [];
    const flaggedTokens: string[] = [];
    let maxScore = 0;
    const underlines: UnderlineHighlight[] = [];

    // 1. SPF Check
    if (/Received-SPF:\s*fail/i.test(rawHeaders)) {
      maxScore = Math.max(maxScore, 85);
      reasons.push('SPF Authentication Failed (sender IP is unauthorized for domain)');
      flaggedTokens.push('Received-SPF: fail');
    } else if (/Received-SPF:\s*softfail/i.test(rawHeaders)) {
      maxScore = Math.max(maxScore, 55);
      reasons.push('SPF Softfail: IP is questionable for domain');
      flaggedTokens.push('Received-SPF: softfail');
    }

    // 2. DKIM Check
    if (/dkim=fail/i.test(rawHeaders)) {
      maxScore = Math.max(maxScore, 80);
      reasons.push('DKIM Signature Verification Failed (email modified in transit or forged)');
      flaggedTokens.push('dkim=fail');
    }

    // 3. DMARC Check
    if (/dmarc=fail/i.test(rawHeaders)) {
      maxScore = Math.max(maxScore, 90);
      reasons.push('DMARC Policy Rejection: Domain owner policy rejected message alignment');
      flaggedTokens.push('dmarc=fail');
    }

    // 4. From vs Reply-To Mismatch Check
    const fromMatch = rawHeaders.match(/From:\s*<?([a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))>?/i);
    const replyToMatch = rawHeaders.match(/Reply-To:\s*<?([a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))>?/i);

    if (fromMatch && replyToMatch) {
      const fromDomain = fromMatch[2].toLowerCase();
      const replyToDomain = replyToMatch[2].toLowerCase();

      if (fromDomain !== replyToDomain) {
        maxScore = Math.max(maxScore, 85);
        const reason = `From vs Reply-To Domain Mismatch: Sender appears as @${fromDomain} but responses route to @${replyToDomain}`;
        reasons.push(reason);
        flaggedTokens.push(`Reply-To: ${replyToMatch[1]}`);

        // Mark underline if present in text
        const offset = input.combinedText.indexOf(replyToMatch[0]);
        if (offset !== -1) {
          underlines.push({
            start: offset,
            end: offset + replyToMatch[0].length,
            type: 'dashed',
            reason,
            text: replyToMatch[0],
          });
        }
      }
    }

    if (reasons.length === 0) {
      return null;
    }

    const level = maxScore >= 70 ? 'HIGH' : maxScore >= 40 ? 'MEDIUM' : 'LOW';
    return this.createEvidence(
      level,
      maxScore,
      `Email Authentication & Header Flaws: ${reasons.join('; ')}`,
      flaggedTokens,
      underlines,
    );
  }
}
