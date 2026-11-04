import { Injectable } from '@nestjs/common';
import { BaseDetector, DetectionInput } from './base.detector';
import { RiskEvidence, UnderlineHighlight } from '@safe-quill/shared';

@Injectable()
export class PromptInjectionDetector extends BaseDetector {
  public override readonly name = 'PromptInjectionDetector';
  public override readonly description =
    'Detects adversarial prompt injections, instruction bypasses, and delimiter attacks targeting LLMs.';

  private static readonly INJECTION_PATTERNS = [
    { pattern: /\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|directions)\b/i, weight: 95, reason: 'Instruction override: Attempts to clear or overwrite system prompts' },
    { pattern: /\bdisregard\s+(all\s+)?(previous|prior)\s+(rules|guidelines|context)\b/i, weight: 90, reason: 'Instruction bypass: Attempts to disregard safety constraints' },
    { pattern: /\byou\s+are\s+now\s+(in\s+developer\s+mode|unconstrained|DAN|an\s+unrestricted\s+ai)\b/i, weight: 95, reason: 'Persona hijacking: Attempts to force an unconstrained persona' },
    { pattern: /\b(print|output|display|reveal)\s+(the\s+)?(system\s+prompt|hidden\s+instructions|developer\s+message)\b/i, weight: 85, reason: 'Prompt exfiltration: Probes for confidential system instructions' },
    { pattern: /(###\s*(system|instruction|human|assistant)|<\|im_start\|>|<\|im_end\|>|\[SYSTEM\])/i, weight: 90, reason: 'Delimiter smuggling: Attempts to inject special LLM chat tokens' },
    { pattern: /\bdo\s+not\s+follow\s+any\s+security\s+checks\b/i, weight: 85, reason: 'Security bypass instruction' },
  ];

  protected override async executeDetection(input: DetectionInput): Promise<RiskEvidence | null> {
    const text = input.combinedText;
    const underlines: UnderlineHighlight[] = [];
    const flaggedTokens: string[] = [];
    let maxWeight = 0;
    const reasons: string[] = [];

    for (const item of PromptInjectionDetector.INJECTION_PATTERNS) {
      const highlights = this.findOffsets(text, item.pattern, 'wavy', item.reason);
      if (highlights.length > 0) {
        underlines.push(...highlights);
        flaggedTokens.push(...highlights.map((h) => h.text || 'injection_token'));
        maxWeight = Math.max(maxWeight, item.weight);
        if (!reasons.includes(item.reason)) {
          reasons.push(item.reason);
        }
      }
    }

    if (underlines.length === 0) {
      return null;
    }

    const level = maxWeight >= 70 ? 'HIGH' : maxWeight >= 40 ? 'MEDIUM' : 'LOW';
    return this.createEvidence(
      level,
      maxWeight,
      `Prompt Injection Detected: ${reasons.join('; ')}`,
      flaggedTokens,
      underlines,
    );
  }
}
