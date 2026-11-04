'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  ChevronDown,
  Loader2,
  Lightbulb,
  Smile,
  FileText,
} from 'lucide-react';
import { RewriteMode } from '@safe-quill/shared';

interface AiToolbarProps {
  onRewrite: (mode: RewriteMode) => void;
  onSuggestSubjects: () => void;
  isLoading: boolean;
  activeAction?: string;
  hasContent: boolean;
}

export function AiToolbar({
  onRewrite,
  onSuggestSubjects,
  isLoading,
  activeAction,
  hasContent,
}: AiToolbarProps) {
  const [showModes, setShowModes] = useState(false);

  const rewriteModes: { mode: RewriteMode; label: string; desc: string }[] = [
    { mode: 'professional', label: 'Professional', desc: 'Refined business tone' },
    { mode: 'friendly', label: 'Friendly', desc: 'Warm and cordial tone' },
    { mode: 'formal', label: 'Formal', desc: 'Executive traditional structure' },
    { mode: 'shorter', label: 'Shorter', desc: 'High-density concise summary' },
    { mode: 'longer', label: 'Longer', desc: 'Expanded detail with polite context' },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-3 py-2 text-xs">
      {/* Left side actions */}
      <div className="flex items-center gap-2">
        {/* Safe Rewrite Button (Primary) */}
        <button
          type="button"
          onClick={() => onRewrite('safe')}
          disabled={isLoading || !hasContent}
          className="inline-flex items-center gap-1.5 rounded border border-fg bg-fg text-bg px-3 py-1 font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title="Strips risky links, neutralizes urgency, and re-scores email"
        >
          {isLoading && activeAction === 'safe' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          <span>Safe Rewrite</span>
        </button>

        {/* Other Tone Modes Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowModes(!showModes)}
            disabled={isLoading || !hasContent}
            className="inline-flex items-center gap-1 rounded border border-border bg-bg px-2.5 py-1 font-medium hover:border-fg disabled:opacity-40 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-muted-fg" />
            <span>Tone Rewrite</span>
            <ChevronDown className="h-3 w-3 text-muted-fg" />
          </button>

          {showModes && (
            <div
              className="absolute left-0 top-full mt-1 w-48 rounded-md border border-border bg-bg p-1 shadow-lg z-30"
              onMouseLeave={() => setShowModes(false)}
            >
              {rewriteModes.map((item) => (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => {
                    setShowModes(false);
                    onRewrite(item.mode);
                  }}
                  className="w-full text-left rounded px-2.5 py-1.5 hover:bg-muted transition-colors flex flex-col"
                >
                  <span className="font-semibold text-xs">{item.label}</span>
                  <span className="text-[10px] text-muted-fg">{item.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Subject Suggestions */}
        <button
          type="button"
          onClick={onSuggestSubjects}
          disabled={isLoading || !hasContent}
          className="inline-flex items-center gap-1.5 rounded border border-border bg-bg px-2.5 py-1 font-medium hover:border-fg disabled:opacity-40 transition-colors"
          title="Generate clean subject lines from email content"
        >
          {isLoading && activeAction === 'subjects' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Lightbulb className="h-3.5 w-3.5 text-muted-fg" />
          )}
          <span className="hidden sm:inline">Suggest Subjects</span>
        </button>
      </div>

      {/* Right side info */}
      <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-muted-fg">
        <span>Groq LLM Assistant</span>
      </div>
    </div>
  );
}
