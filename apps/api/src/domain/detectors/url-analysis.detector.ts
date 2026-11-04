import { Injectable } from '@nestjs/common';
import { BaseDetector, DetectionInput } from './base.detector';
import { RiskEvidence, UnderlineHighlight } from '@safe-quill/shared';

@Injectable()
export class UrlAnalysisDetector extends BaseDetector {
  public override readonly name = 'UrlAnalysisDetector';
  public override readonly description =
    'Inspects URLs for IP hosts, shortened links, suspicious TLDs, embedded credentials, and SSRF attacks.';

  private static readonly URL_REGEX = /https?:\/\/[^\s<>"'{}|\\^`[\]]+/gi;

  private static readonly SUSPICIOUS_TLDS = new Set([
    'xyz', 'top', 'cc', 'ru', 'tk', 'buzz', 'fit', 'work', 'gq', 'ml', 'cf', 'ga', 'rest', 'icu'
  ]);

  private static readonly SHORTENERS = new Set([
    'bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'ow.ly', 'cutt.ly', 'buff.ly', 'rebrand.ly'
  ]);

  // Strict SSRF IP blocks: RFC 1918, link-local, loopback, cloud metadata
  private static readonly PRIVATE_IP_PATTERNS = [
    /^127\./,                          // 127.0.0.0/8 (Loopback)
    /^10\./,                           // 10.0.0.0/8 (Private)
    /^192\.168\./,                     // 192.168.0.0/16 (Private)
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12 (Private)
    /^169\.254\./,                     // 169.254.0.0/16 (Link-local / AWS/GCP Metadata)
    /^0\./,                            // 0.0.0.0/8
    /^localhost$/i,                    // localhost
  ];

  protected override async executeDetection(input: DetectionInput): Promise<RiskEvidence | null> {
    const text = input.combinedText;
    const matches = text.match(UrlAnalysisDetector.URL_REGEX);

    if (!matches || matches.length === 0) {
      return null;
    }

    const underlines: UnderlineHighlight[] = [];
    const flaggedTokens: string[] = [];
    const reasons: string[] = [];
    let maxScore = 0;

    for (const rawUrl of matches) {
      try {
        const parsed = new URL(rawUrl);
        const hostname = parsed.hostname.toLowerCase();
        let flagged = false;
        let urlRisk = 0;
        let specificReason = '';

        // 1. SSRF & Internal IP / Host check
        const isSsrfTarget = UrlAnalysisDetector.PRIVATE_IP_PATTERNS.some((p) => p.test(hostname));
        if (isSsrfTarget) {
          urlRisk = Math.max(urlRisk, 95);
          flagged = true;
          specificReason = `SSRF attempt: URL targets restricted/internal host (${hostname})`;
        }

        // 2. Raw IP address hostname (e.g. http://185.220.101.5/login)
        const isRawIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
        if (isRawIp && !isSsrfTarget) {
          urlRisk = Math.max(urlRisk, 85);
          flagged = true;
          specificReason = `Direct IP URL: Phishers frequently use raw IP addresses to bypass domain reputation checks`;
        }

        // 3. Embedded credentials in URL (e.g. http://user:pass@domain.com)
        if (parsed.username || parsed.password) {
          urlRisk = Math.max(urlRisk, 90);
          flagged = true;
          specificReason = `Credential obfuscation in URL: contains embedded user/password`;
        }

        // 4. Shortened link detection
        if (UrlAnalysisDetector.SHORTENERS.has(hostname)) {
          urlRisk = Math.max(urlRisk, 70);
          flagged = true;
          specificReason = `Shortened URL (${hostname}): Cloaks true destination to conceal malicious redirects`;
        }

        // 5. High-risk TLDs
        const parts = hostname.split('.');
        const tld = parts.length > 1 ? parts[parts.length - 1] : '';
        if (UrlAnalysisDetector.SUSPICIOUS_TLDS.has(tld)) {
          urlRisk = Math.max(urlRisk, 75);
          flagged = true;
          specificReason = `High-abuse TLD (.${tld}): Frequently associated with spam campaigns`;
        }

        if (flagged) {
          maxScore = Math.max(maxScore, urlRisk);
          flaggedTokens.push(rawUrl);
          if (!reasons.includes(specificReason)) {
            reasons.push(specificReason);
          }

          // Find exact offsets for underline
          let startIndex = 0;
          while ((startIndex = text.indexOf(rawUrl, startIndex)) !== -1) {
            underlines.push({
              start: startIndex,
              end: startIndex + rawUrl.length,
              type: 'dashed',
              reason: specificReason,
              text: rawUrl,
            });
            startIndex += rawUrl.length;
          }
        }
      } catch {
        // Malformed URL
        maxScore = Math.max(maxScore, 65);
        flaggedTokens.push(rawUrl);
        reasons.push('Malformed URL syntax');
      }
    }

    if (underlines.length === 0) {
      return null;
    }

    const level = maxScore >= 70 ? 'HIGH' : maxScore >= 40 ? 'MEDIUM' : 'LOW';
    return this.createEvidence(
      level,
      maxScore,
      `Suspicious URL Analysis: ${reasons.join('; ')}`,
      flaggedTokens,
      underlines,
    );
  }
}
