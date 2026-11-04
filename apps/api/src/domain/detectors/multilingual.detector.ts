import { Injectable } from '@nestjs/common';
import { BaseDetector, DetectionInput } from './base.detector';
import { RiskEvidence, UnderlineHighlight } from '@safe-quill/shared';

@Injectable()
export class MultilingualDetector extends BaseDetector {
  public override readonly name = 'MultilingualDetector';
  public override readonly description =
    'Detects multilingual phishing cues, international coercion phrases, and non-English social engineering lures.';

  private static readonly MULTILINGUAL_PATTERNS = [
    // Spanish
    {
      lang: 'Spanish',
      pattern: /\b(cuenta\s+(suspendida|bloqueada|cancelada)|verifique\s+(su\s+cuenta|sus\s+datos)|transfiera\s+inmediatamente|actividad\s+sospechosa|acceso\s+bloqueado|actualice\s+sus\s+credenciales)\b/gi,
      score: 82,
      reason: 'Spanish phishing coercion: threat of account suspension or urgent verification',
    },
    // German
    {
      lang: 'German',
      pattern: /\b(konto\s+(gesperrt|deaktiviert|blockiert)|überweisen\s+sie\s+sofort|dringende\s+handlung\s+erforderlich|passwort\s+abgelaufen|bestätigen\s+sie\s+ihre\s+identität|unbefugter\s+zugriff)\b/gi,
      score: 82,
      reason: 'German phishing coercion: urgent account locking or immediate payment demand',
    },
    // French
    {
      lang: 'French',
      pattern: /\b(compte\s+(suspendu|bloqué|clôturé)|veuillez\s+vérifier\s+votre\s+compte|virement\s+urgent|action\s+requise\s+immédiatement|accès\s+restreint|activité\s+inhabituelle)\b/gi,
      score: 82,
      reason: 'French phishing coercion: account lockout threat or immediate action required',
    },
    // Russian
    {
      lang: 'Russian',
      pattern: /(счет\s+(заблокирован|приостановлен)|срочно\s+подтвердите|несанкционированный\s+вход|восстановите\s+доступ|введите\s+пароль)/gi,
      score: 85,
      reason: 'Russian phishing coercion: urgent account lockout and credential harvesting lure',
    },
  ];

  protected override async executeDetection(input: DetectionInput): Promise<RiskEvidence | null> {
    const text = input.combinedText;
    const underlines: UnderlineHighlight[] = [];
    const flaggedTokens: string[] = [];
    const reasons: string[] = [];
    let maxScore = 0;

    for (const item of MultilingualDetector.MULTILINGUAL_PATTERNS) {
      const hits = this.findOffsets(text, item.pattern, 'solid', item.reason);
      if (hits.length > 0) {
        underlines.push(...hits);
        flaggedTokens.push(...hits.map((h) => `${item.lang}: ${h.text || 'phrase'}`));
        maxScore = Math.max(maxScore, item.score);
        if (!reasons.includes(item.reason)) {
          reasons.push(item.reason);
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
      reasons.join('; '),
      Array.from(new Set(flaggedTokens)),
      underlines,
    );
  }
}
