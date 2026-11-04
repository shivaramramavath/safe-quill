'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ShieldAlert,
  Link2,
  Mail,
  UserCheck,
  KeyRound,
  FileCode,
  DollarSign,
} from 'lucide-react';
import { RiskEvidence } from '@safe-quill/shared';

interface ExplanationsPanelProps {
  evidence: RiskEvidence[];
}

export function ExplanationsPanel({ evidence }: ExplanationsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!evidence || evidence.length === 0) {
    return null;
  }

  const getDetectorIcon = (name: string) => {
    switch (name) {
      case 'PromptInjectionDetector':
        return <FileCode className="h-4 w-4" />;
      case 'UrlAnalysisDetector':
        return <Link2 className="h-4 w-4" />;
      case 'SenderLookalikeDetector':
        return <UserCheck className="h-4 w-4" />;
      case 'HeaderAnalysisDetector':
        return <Mail className="h-4 w-4" />;
      case 'SensitiveDataDetector':
        return <KeyRound className="h-4 w-4" />;
      case 'BecPatternDetector':
        return <DollarSign className="h-4 w-4" />;
      case 'UrgencySocialEngineeringDetector':
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getFriendlyName = (name: string) => {
    switch (name) {
      case 'PromptInjectionDetector':
        return 'Prompt Injection Defense';
      case 'UrlAnalysisDetector':
        return 'Malicious URL & SSRF Inspection';
      case 'SenderLookalikeDetector':
        return 'Sender Homoglyph & Lookalike Spoofing';
      case 'HeaderAnalysisDetector':
        return 'Authentication & Header Integrity';
      case 'SensitiveDataDetector':
        return 'Sensitive Credential & PII Leakage';
      case 'BecPatternDetector':
        return 'Business Email Compromise (BEC)';
      case 'UrgencySocialEngineeringDetector':
        return 'Social Engineering & Urgency Coercion';
      default:
        return name;
    }
  };

  return (
    <div
      role="region"
      aria-label="Security Explanations & Evidence Panel"
      className="rounded-lg border border-border bg-bg overflow-hidden shadow-sm transition-all"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-fg" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider">
            Detected Security Evidence ({evidence.length})
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1 text-xs font-mono text-muted-fg hover:text-fg transition-colors"
          aria-expanded={isExpanded}
        >
          <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Explanations List */}
      {isExpanded && (
        <div className="divide-y divide-border">
          {evidence.map((item, idx) => {
            const isHigh = item.level === 'HIGH';
            const isMedium = item.level === 'MEDIUM';

            return (
              <div key={idx} className="p-4 flex flex-col gap-2 hover:bg-muted/10 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-xs sm:text-sm">
                    <span className="text-muted-fg">{getDetectorIcon(item.detectorName)}</span>
                    <span>{getFriendlyName(item.detectorName)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        isHigh
                          ? 'border-accent-high text-accent-high bg-accent-high/10'
                          : isMedium
                          ? 'border-fg text-fg bg-fg/10'
                          : 'border-border text-muted-fg bg-bg'
                      }`}
                    >
                      {item.level} ({item.score}/100)
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-fg leading-relaxed">
                  {item.reason}
                </p>

                {/* Flagged Tokens with Underline Indicator */}
                {item.flaggedTokens && item.flaggedTokens.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 pt-1 border-t border-border/40">
                    <span className="text-[10px] font-mono text-muted-fg uppercase">
                      Flagged:
                    </span>
                    {item.flaggedTokens.map((tok, tokIdx) => {
                      const underlineStyle =
                        item.underlines && item.underlines[0]
                          ? item.underlines[0].type === 'solid'
                            ? 'underline-risk-solid'
                            : item.underlines[0].type === 'dashed'
                            ? 'underline-risk-dashed'
                            : 'underline-risk-wavy'
                          : 'underline-risk-dashed';

                      return (
                        <span
                          key={tokIdx}
                          className={`font-mono text-[11px] px-2 py-0.5 rounded bg-muted/40 border border-border ${underlineStyle}`}
                          title={`Flagged token (${underlineStyle.replace('underline-risk-', '')} underline style)`}
                        >
                          {tok}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
