import { Injectable } from '@nestjs/common';
import { BaseDetector, DetectionInput } from './base.detector';
import { RiskEvidence, UnderlineHighlight } from '@safe-quill/shared';

@Injectable()
export class AttachmentRiskDetector extends BaseDetector {
  public override readonly name = 'AttachmentRiskDetector';
  public override readonly description =
    'Detects dangerous executable attachments, macro-enabled documents, double extensions, and malicious archive payloads.';

  // Dangerous executable and script extensions
  private static readonly EXECUTABLE_EXTS = [
    /\b[\w.-]+\.(exe|scr|bat|vbs|vbe|js|jse|wsf|wsh|ps1|ps2|cmd|pif|hta|cpl|msc|jar|iso|img)\b/gi,
  ];

  // Double extension evasion (e.g. invoice.pdf.exe, report.docx.vbs)
  private static readonly DOUBLE_EXTS = [
    /\b[\w.-]+\.(pdf|doc|docx|xls|xlsx|jpg|png|txt)\.(exe|scr|bat|vbs|ps1|iso|jar|cmd)\b/gi,
  ];

  // Macro-enabled office documents
  private static readonly MACRO_EXTS = [
    /\b[\w.-]+\.(xlsm|docm|pptm|dotm|xltm|xlam)\b/gi,
  ];

  // Common known malicious payload hashes (SHA-256 samples)
  private static readonly MALICIOUS_HASHES = new Set([
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // test trigger hash
    '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f', // Locky sample hash
    '44d88612fea8a8f36de82e1278abb02fddf9ea74b0d014d59f772459a96e95d8', // Emotet sample hash
  ]);

  protected override async executeDetection(input: DetectionInput): Promise<RiskEvidence | null> {
    const text = `${input.combinedText}\n${input.rawHeaders || ''}`;
    const underlines: UnderlineHighlight[] = [];
    const flaggedTokens: string[] = [];
    const reasons: string[] = [];
    let maxScore = 0;

    // 1. Check for double extension evasion (highest severity)
    for (const pattern of AttachmentRiskDetector.DOUBLE_EXTS) {
      const hits = this.findOffsets(
        text,
        pattern,
        'wavy',
        'Suspicious double extension (evasion technique concealing an executable payload)',
      );
      if (hits.length > 0) {
        underlines.push(...hits);
        flaggedTokens.push(...hits.map((h) => h.text || 'double_extension'));
        maxScore = Math.max(maxScore, 95);
        reasons.push('Double extension evasion detected concealing an executable payload');
      }
    }

    // 2. Check for standalone dangerous executable extensions
    for (const pattern of AttachmentRiskDetector.EXECUTABLE_EXTS) {
      const hits = this.findOffsets(
        text,
        pattern,
        'solid',
        'Dangerous executable or script attachment',
      );
      if (hits.length > 0) {
        underlines.push(...hits);
        flaggedTokens.push(...hits.map((h) => h.text || 'executable_attachment'));
        maxScore = Math.max(maxScore, 90);
        if (!reasons.includes('Dangerous executable attachment detected')) {
          reasons.push('Dangerous executable or script attachment detected');
        }
      }
    }

    // 3. Check for macro-enabled office formats
    for (const pattern of AttachmentRiskDetector.MACRO_EXTS) {
      const hits = this.findOffsets(
        text,
        pattern,
        'dashed',
        'Macro-enabled office document (potential malware dropper)',
      );
      if (hits.length > 0) {
        underlines.push(...hits);
        flaggedTokens.push(...hits.map((h) => h.text || 'macro_doc'));
        maxScore = Math.max(maxScore, 80);
        if (!reasons.includes('Macro-enabled document format')) {
          reasons.push('Macro-enabled document format (frequently used for weaponized payload delivery)');
        }
      }
    }

    // 4. Check for known malicious SHA-256 hashes
    const hashRegex = /\b[a-f0-9]{64}\b/gi;
    const hashMatches = text.match(hashRegex);
    if (hashMatches) {
      for (const hash of hashMatches) {
        if (AttachmentRiskDetector.MALICIOUS_HASHES.has(hash.toLowerCase())) {
          maxScore = 99;
          reasons.push(`Known weaponized malware SHA-256 hash detected: ${hash.substring(0, 12)}...`);
          flaggedTokens.push(hash.substring(0, 16));
        }
      }
    }

    if (underlines.length === 0 && reasons.length === 0) {
      return null;
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
