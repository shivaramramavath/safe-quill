'use client';

import React from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { RiskLevel } from '@safe-quill/shared';

interface ScoreMeterProps {
  score?: number;
  level?: RiskLevel;
  isAnalyzing?: boolean;
}

export function ScoreMeter({ score = 0, level = 'LOW', isAnalyzing = false }: ScoreMeterProps) {
  // Compute filled blocks out of 10
  const blocks = 10;
  const filledBlocks = Math.round((score / 100) * blocks);

  const isHigh = level === 'HIGH';
  const isMedium = level === 'MEDIUM';

  return (
    <div
      role="region"
      aria-label="Email Risk Assessment Meter"
      className="rounded-lg border border-border bg-muted/20 p-4 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isHigh ? (
            <ShieldAlert className="h-5 w-5 text-accent-high" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-fg" aria-hidden="true" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-fg font-mono">
            Spam & Phishing Verdict
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-bold font-mono border ${
              isHigh
                ? 'border-accent-high text-accent-high bg-accent-high/10'
                : isMedium
                ? 'border-fg text-fg bg-fg/10'
                : 'border-border text-muted-fg bg-bg'
            }`}
          >
            {level} RISK
          </span>
          <span className="font-mono text-sm font-bold tracking-tight">
            {score}/100
          </span>
        </div>
      </div>

      {/* Segmented Risk Meter (accessible without relying on color alone) */}
      <div
        className="grid grid-cols-10 gap-1 h-3 rounded overflow-hidden"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Risk score: ${score} out of 100, ${level} risk`}
      >
        {Array.from({ length: blocks }).map((_, i) => {
          const isFilled = i < filledBlocks;
          return (
            <div
              key={i}
              className={`rounded-sm transition-all duration-300 ${
                isFilled
                  ? isHigh
                    ? 'bg-accent-high'
                    : 'bg-fg'
                  : 'bg-muted border border-border/50'
              }`}
            />
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-fg font-mono">
        <span>0 SAFE</span>
        <span>{isAnalyzing ? 'Analyzing...' : 'Ready'}</span>
        <span>100 HIGH RISK</span>
      </div>
    </div>
  );
}
