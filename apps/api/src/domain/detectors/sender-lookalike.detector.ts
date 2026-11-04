import { Injectable } from '@nestjs/common';
import { BaseDetector, DetectionInput } from './base.detector';
import { RiskEvidence, UnderlineHighlight } from '@safe-quill/shared';

@Injectable()
export class SenderLookalikeDetector extends BaseDetector {
  public override readonly name = 'SenderLookalikeDetector';
  public override readonly description =
    'Identifies lookalike/homograph domain attacks, Cyrillic character spoofing, and brand display name mismatches.';

  // Trusted brands commonly impersonated
  private static readonly TARGET_BRANDS = [
    'google', 'microsoft', 'apple', 'amazon', 'paypal', 'netflix', 'facebook', 'chase', 'bankofamerica', 'docusign'
  ];

  // Common Cyrillic lookalikes for Latin chars: а (U+0430), о (U+043E), е (U+0435), с (U+0441), р (U+0440), у (U+0443), х (U+0445)
  private static readonly CYRILLIC_HOMOGLYPH_REGEX = /[\u0430\u043E\u0435\u0441\u0440\u0443\u0445\u0456\u0458]/;

  // Typosquatting digit / symbol substitutions: paypa1, micros0ft, amaz0n, g00gle, app1e
  private static readonly TYPOSQUAT_PATTERNS = [
    { pattern: /\b(paypa[1l]|p[4a]ypal|pay-pal)\b/i, brand: 'PayPal' },
    { pattern: /\b(g[0o]{2}g[1l]e|go0gle|g0ogle)\b/i, brand: 'Google' },
    { pattern: /\b(micr[0o]s[0o]ft|m1crosoft)\b/i, brand: 'Microsoft' },
    { pattern: /\b(am[a4]z[0o]n|amazn)\b/i, brand: 'Amazon' },
    { pattern: /\b(app[1l]e|ap-ple)\b/i, brand: 'Apple' },
    { pattern: /\b(netfl[1i]x|net-flix)\b/i, brand: 'Netflix' },
    { pattern: /\b(d[0o]cus[1i]gn|docu-sign)\b/i, brand: 'DocuSign' },
  ];

  protected override async executeDetection(input: DetectionInput): Promise<RiskEvidence | null> {
    const text = input.combinedText;
    const underlines: UnderlineHighlight[] = [];
    const flaggedTokens: string[] = [];
    const reasons: string[] = [];
    let maxScore = 0;

    // 1. Check for Cyrillic / Homoglyph spoofing within domain tokens or words
    const words = text.split(/\s+/);
    for (const word of words) {
      if (SenderLookalikeDetector.CYRILLIC_HOMOGLYPH_REGEX.test(word)) {
        // Contains mixed Cyrillic homoglyphs
        maxScore = Math.max(maxScore, 92);
        flaggedTokens.push(word);
        const reason = `Homoglyph spoofing: "${word}" uses hidden Cyrillic/Unicode characters visually mimicking Latin characters`;
        if (!reasons.includes(reason)) reasons.push(reason);

        underlines.push(...this.findOffsets(text, new RegExp(this.escapeRegExp(word), 'g'), 'dashed', reason));
      }
    }

    // 2. Check for Typosquatting substitutions
    for (const item of SenderLookalikeDetector.TYPOSQUAT_PATTERNS) {
      const highlights = this.findOffsets(text, item.pattern, 'dashed', `Typosquatting: Deceptive variant mimicking ${item.brand}`);
      if (highlights.length > 0) {
        maxScore = Math.max(maxScore, 85);
        flaggedTokens.push(...highlights.map((h) => h.text || 'typosquat'));
        const reason = `Deceptive brand lookalike detected for ${item.brand}`;
        if (!reasons.includes(reason)) reasons.push(reason);
        underlines.push(...highlights);
      }
    }

    // 3. Sender Display Name Spoofing in headers or body (e.g. From: "PayPal Support" <billing@random123.com>)
    const fromLineMatch = text.match(/from:\s*["']?([^"'<]+)["']?\s*<([^>]+)>/i);
    if (fromLineMatch) {
      const displayName = fromLineMatch[1].toLowerCase();
      const email = fromLineMatch[2].toLowerCase();

      for (const brand of SenderLookalikeDetector.TARGET_BRANDS) {
        if (displayName.includes(brand) && !email.includes(`${brand}.com`)) {
          maxScore = Math.max(maxScore, 90);
          const reason = `Display name spoofing: Sender claims to be "${fromLineMatch[1]}" but email address is from foreign domain (@${email.split('@')[1] || 'unknown'})`;
          reasons.push(reason);
          flaggedTokens.push(fromLineMatch[0]);

          const startIndex = text.indexOf(fromLineMatch[0]);
          if (startIndex !== -1) {
            underlines.push({
              start: startIndex,
              end: startIndex + fromLineMatch[0].length,
              type: 'dashed',
              reason,
              text: fromLineMatch[0],
            });
          }
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
      `Lookalike & Spoofing Detected: ${reasons.join('; ')}`,
      flaggedTokens,
      underlines,
    );
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
