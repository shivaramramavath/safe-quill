'use client';

import React from 'react';
import { ShieldCheck, ShieldAlert, Zap, Database } from 'lucide-react';
import { RiskLevel, TokenWeight } from '@safe-quill/shared';

interface ScoreMeterProps {
  score?: number;
  level?: RiskLevel;
  isAnalyzing?: boolean;
  latencyMs?: number;
  cached?: boolean;
  modelVersion?: string;
  topTokens?: TokenWeight[];
}

export function ScoreMeter({
  score = 0,
  level = 'LOW',
  isAnalyzing = false,
  latencyMs,
  cached = false,
  modelVersion = 'v1.0.0',
  topTokens = [],
}: ScoreMeterProps) {
  const blocks = 10;
  const filledBlocks = Math.round((score / 100) * blocks);

  const isHigh = level === 'HIGH';
  const isMedium = level === 'MEDIUM';

  return (
    <div
      role="region"
      aria-label="Real-time Email Risk Assessment Meter"
      className="rounded-lg border border-border bg-muted/20 p-4 transition-all"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {isHigh ? (
            <ShieldAlert className="h-5 w-5 text-accent-high" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-fg" aria-hidden="true" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-fg font-mono">
            Spam & Phishing Verdict
          </span>
          <span className="text-[10px] text-muted-fg font-mono border border-border rounded px-1.5 py-0.5">
            ML {modelVersion}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Latency & Cache Indicator */}
          {latencyMs !== undefined && (
            <div className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border border-border bg-bg text-muted-fg">
              {cached ? (
                <>
                  <Database className="h-3 w-3 text-fg" />
                  <span>{latencyMs}ms (cached)</span>
                </>
              ) : (
                <>
                  <Zap className="h-3 w-3 text-fg" />
                  <span>{latencyMs}ms (live)</span>
                </>
              )}
            </div>
          )}

          <span
            className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono border ${
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

      {/* Segmented Risk Meter (Accessible 10-block progress bar) */}
      <div
        className="grid grid-cols-10 gap-1.5 h-3 rounded overflow-hidden"
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
                  : 'bg-muted border border-border/60'
              }`}
            />
          );
        })}
      </div>

      {/* Footer labels */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-fg font-mono">
        <span>0 SAFE</span>
        <span>{isAnalyzing ? 'Analyzing email...' : 'Ready'}</span>
        <span>100 HIGH RISK</span>
      </div>

      {/* Top Risky Tokens Highlight Panel */}
      {topTokens && topTokens.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-mono text-muted-fg uppercase mr-1">
            Top Risky Tokens:
          </span>
          {topTokens.map((tokenObj, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded border border-border bg-bg underline-risk-dashed"
              title={`Contribution weight: ${tokenObj.weight}`}
            >
              <span>{tokenObj.token}</span>
              <span className="text-[10px] text-muted-fg">({tokenObj.weight})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
