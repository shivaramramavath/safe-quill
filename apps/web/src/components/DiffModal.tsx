'use client';

import React from 'react';
import {
  Check,
  X,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Cpu,
  Loader2,
} from 'lucide-react';
import { RewriteEmailResponse } from '@safe-quill/shared';
import { DiffSkeleton } from './Skeleton';

interface DiffModalProps {
  isOpen: boolean;
  rewriteData: RewriteEmailResponse | null;
  streamingText?: string;
  isStreaming?: boolean;
  onClose: () => void;
  onAccept: (rewrittenText: string) => void;
}

export function DiffModal({
  isOpen,
  rewriteData,
  streamingText,
  isStreaming = false,
  onClose,
  onAccept,
}: DiffModalProps) {
  if (!isOpen) return null;

  const isSafeMode = rewriteData?.mode === 'safe';
  const displayText = isStreaming ? streamingText : rewriteData?.rewrittenText;
  const scoreDropped = rewriteData && rewriteData.originalScore > rewriteData.newScore;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="w-full max-w-4xl rounded-lg border border-border bg-bg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded border border-border bg-fg text-bg">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="diff-modal-title" className="text-sm sm:text-base font-bold tracking-tight">
                  {isSafeMode
                    ? 'Safe Rewrite & De-Weaponization'
                    : `LangGraph AI Rewrite (${rewriteData?.mode.toUpperCase() || 'STREAMING'})`}
                </h2>
                <span className="text-[10px] font-mono border border-border px-1.5 py-0.5 rounded bg-bg text-muted-fg">
                  Provider: {rewriteData?.provider || 'LangGraph Stream'}
                </span>
                {isStreaming && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono border border-fg px-2 py-0.5 rounded bg-fg text-bg animate-pulse">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    Streaming...
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-fg mt-0.5">
                Review proposed changes before applying to your editor draft.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 hover:bg-muted text-muted-fg hover:text-fg transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Loading Skeleton when waiting for initial stream tokens */}
        {isStreaming && !displayText && (
          <DiffSkeleton />
        )}

        {/* Score & Verdict Comparison Banner */}
        {rewriteData && (
          <div className="border-b border-border bg-muted/15 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono uppercase text-muted-fg font-semibold">
                Risk Verdict:
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-xs px-2 py-0.5 rounded border ${
                    rewriteData.originalLevel === 'HIGH'
                      ? 'border-accent-high text-accent-high bg-accent-high/10'
                      : 'border-border text-muted-fg bg-bg'
                  }`}
                >
                  {rewriteData.originalScore}/100 ({rewriteData.originalLevel})
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-fg" />
                <span
                  className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                    rewriteData.newLevel === 'LOW'
                      ? 'border-fg text-fg bg-fg/10'
                      : 'border-border text-muted-fg bg-bg'
                  }`}
                >
                  {rewriteData.newScore}/100 ({rewriteData.newLevel})
                </span>
              </div>

              {scoreDropped && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-fg bg-muted px-2 py-0.5 rounded border border-border">
                  <ShieldCheck className="h-3 w-3" />
                  Score Dropped by {rewriteData.originalScore - rewriteData.newScore} pts
                </span>
              )}
            </div>

            {rewriteData.tone && (
              <div className="flex items-center gap-2 text-xs font-mono text-muted-fg">
                <span>Tone: <strong>{rewriteData.tone.tone}</strong></span>
                <span className="text-border">|</span>
                <span>Politeness: <strong>{rewriteData.tone.politenessScore}/100</strong></span>
              </div>
            )}
          </div>
        )}

        {/* AI Explanation Bar */}
        {rewriteData?.explanation && (
          <div className="border-b border-border bg-muted/20 px-6 py-2.5 text-xs text-muted-fg leading-relaxed">
            <span className="font-semibold text-fg">Analysis & Neutralization: </span>
            {rewriteData.explanation}
          </div>
        )}

        {/* Side-by-side Before & After Diff Body */}
        {(!isStreaming || displayText) && (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border overflow-y-auto p-6 gap-6">
            {/* Before */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase font-bold text-muted-fg">
                  Original Draft
                </span>
                <span className="text-[10px] font-mono text-muted-fg">
                  {rewriteData?.originalText.length || 0} chars
                </span>
              </div>
              <div className="flex-1 rounded border border-border bg-muted/10 p-4 text-xs sm:text-sm font-sans leading-relaxed whitespace-pre-wrap select-text opacity-80">
                {rewriteData?.originalText}
              </div>
            </div>

            {/* After */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase font-bold text-fg flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Rewritten Output
                </span>
                <span className="text-[10px] font-mono text-muted-fg">
                  {displayText?.length || 0} chars
                </span>
              </div>
              <div className="flex-1 rounded border border-fg/30 bg-bg p-4 text-xs sm:text-sm font-sans leading-relaxed whitespace-pre-wrap select-text focus:outline-none relative">
                {displayText}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-fg animate-pulse align-middle" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Action Footer */}
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-6 py-3.5">
          <div className="text-[11px] font-mono text-muted-fg flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            <span>Pasted email content was wrapped in untrusted delimiters and checked for prompt injections.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border px-3.5 py-1.5 text-xs font-semibold hover:bg-muted transition-colors"
            >
              {isStreaming ? 'Cancel' : 'Reject'}
            </button>
            <button
              type="button"
              disabled={isStreaming || !displayText}
              onClick={() => {
                if (displayText) {
                  onAccept(displayText);
                  onClose();
                }
              }}
              className="inline-flex items-center gap-1.5 rounded bg-fg text-bg px-4 py-1.5 text-xs font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Accept Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
