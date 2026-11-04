'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  ChevronDown,
  Loader2,
  Compass,
  Eye,
  PenTool,
} from 'lucide-react';
import { RewriteMode } from '@safe-quill/shared';
import { useDraftStore } from '../store/useDraftStore';
import { EMAIL_SAMPLES } from '../lib/samples';

interface AiToolbarProps {
  onRewrite: (mode: RewriteMode) => void;
  onAiAction: (action: string, targetLanguage?: string) => void;
  isLoading: boolean;
  activeAction?: string;
  hasContent: boolean;
}

export function AiToolbar({
  onRewrite,
  onAiAction,
  isLoading,
  activeAction,
  hasContent,
}: AiToolbarProps) {
  const {
    editorMode,
    setEditorMode,
    setSubject,
    setBody,
    setRawHeaders,
  } = useDraftStore();

  const [showModes, setShowModes] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const [selectedLang, setSelectedLang] = useState('Spanish');

  const rewriteModes: { mode: RewriteMode; label: string; desc: string }[] = [
    { mode: 'professional', label: 'Professional', desc: 'Refined business tone' },
    { mode: 'friendly', label: 'Friendly', desc: 'Warm and cordial tone' },
    { mode: 'formal', label: 'Formal', desc: 'Executive traditional structure' },
    { mode: 'shorter', label: 'Shorter', desc: 'High-density concise summary' },
    { mode: 'longer', label: 'Longer', desc: 'Expanded detail with polite context' },
  ];

  const handleSelectSample = (sampleId: string) => {
    const s = EMAIL_SAMPLES.find((item) => item.id === sampleId);
    if (s) {
      setSubject(s.subject);
      setBody(s.body);
      setRawHeaders(s.rawHeaders || '');
    }
    setShowSamples(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-3 py-2 text-xs">
      {/* Left side actions: Safe Rewrite, Tone, More Actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Safe Rewrite Button (Primary) */}
        <button
          type="button"
          onClick={() => onRewrite('safe')}
          disabled={isLoading || !hasContent}
          className="inline-flex items-center gap-1.5 rounded border border-fg bg-fg text-bg px-2.5 py-1 font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title="Strips risky links, neutralizes urgency, and re-scores email"
        >
          {isLoading && activeAction === 'safe' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          <span>Safe Rewrite</span>
        </button>

        {/* Tone Rewrite Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowModes(!showModes)}
            disabled={isLoading || !hasContent}
            className="inline-flex items-center gap-1 rounded border border-border bg-bg px-2 py-1 font-medium hover:border-fg disabled:opacity-40 transition-colors"
          >
            <Sparkles className="h-3 w-3 text-muted-fg" />
            <span>Tone</span>
            <ChevronDown className="h-3 w-3 text-muted-fg" />
          </button>

          {showModes && (
            <div
              className="absolute left-0 top-full mt-1 w-44 rounded-md border border-border bg-bg p-1 shadow-lg z-30"
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

        {/* More AI Actions (Fix grammar, Expand, Shorten, Translate, Generate reply) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowActions(!showActions)}
            disabled={isLoading || !hasContent}
            className="inline-flex items-center gap-1 rounded border border-border bg-bg px-2 py-1 font-medium hover:border-fg disabled:opacity-40 transition-colors"
          >
            <span>More Actions</span>
            <ChevronDown className="h-3 w-3 text-muted-fg" />
          </button>

          {showActions && (
            <div
              className="absolute left-0 top-full mt-1 w-52 rounded-md border border-border bg-bg p-1 shadow-lg z-30 text-xs font-mono"
              onMouseLeave={() => setShowActions(false)}
            >
              <button
                type="button"
                onClick={() => {
                  setShowActions(false);
                  onAiAction('fix_grammar');
                }}
                className="w-full text-left px-2 py-1.5 hover:bg-muted rounded transition-colors"
              >
                Fix Grammar & Typos
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowActions(false);
                  onAiAction('expand');
                }}
                className="w-full text-left px-2 py-1.5 hover:bg-muted rounded transition-colors"
              >
                Expand with Context
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowActions(false);
                  onAiAction('shorten');
                }}
                className="w-full text-left px-2 py-1.5 hover:bg-muted rounded transition-colors"
              >
                Shorten Aggressively
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowActions(false);
                  onAiAction('generate_reply');
                }}
                className="w-full text-left px-2 py-1.5 hover:bg-muted rounded transition-colors"
              >
                Generate Reply
              </button>
              <div className="border-t border-border my-1" />
              <div className="px-2 py-1 flex items-center justify-between text-[11px]">
                <span>Translate:</span>
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  className="p-0.5 border border-border bg-bg rounded text-[10px]"
                >
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Japanese">Japanese</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowActions(false);
                  onAiAction('translate', selectedLang);
                }}
                className="w-full text-left px-2 py-1 hover:bg-muted rounded text-[11px] font-semibold"
              >
                Translate to {selectedLang}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right side controls: Mode Toggle & Samples */}
      <div className="flex items-center gap-2">
        {/* Sample Library Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSamples(!showSamples)}
            className="inline-flex items-center gap-1 border border-border bg-bg px-2 py-1 font-mono text-[11px] rounded hover:border-fg transition-colors"
            title="Try pre-built realistic email scenarios"
          >
            <Compass className="h-3 w-3 text-muted-fg" />
            <span className="hidden sm:inline">Samples</span>
            <ChevronDown className="h-2.5 w-2.5 text-muted-fg" />
          </button>

          {showSamples && (
            <div
              className="absolute right-0 top-full mt-1 w-56 rounded-md border border-border bg-bg p-1 shadow-lg z-30 font-sans"
              onMouseLeave={() => setShowSamples(false)}
            >
              <div className="px-2 py-1 font-mono text-[10px] uppercase text-muted-fg border-b border-border">
                Try a Sample Email
              </div>
              {EMAIL_SAMPLES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSelectSample(sample.id)}
                  className="w-full text-left px-2 py-1.5 hover:bg-muted rounded transition-colors flex flex-col"
                >
                  <span className="font-semibold text-xs">{sample.title}</span>
                  <span className="text-[10px] font-mono text-muted-fg uppercase">
                    {sample.category} &middot; {sample.expectedScore} Risk
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mode Toggle: Inspect vs Compose */}
        <div className="flex items-center border border-border rounded overflow-hidden text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setEditorMode('inspect')}
            className={`px-2 py-1 flex items-center gap-1 transition-colors ${
              editorMode === 'inspect'
                ? 'bg-fg text-bg font-bold'
                : 'bg-bg text-muted-fg hover:text-fg'
            }`}
            title="Inspect: Is this email safe? (prioritizes phishing detection)"
          >
            <Eye className="h-3 w-3" />
            <span>Inspect</span>
          </button>
          <button
            type="button"
            onClick={() => setEditorMode('compose')}
            className={`px-2 py-1 flex items-center gap-1 transition-colors ${
              editorMode === 'compose'
                ? 'bg-fg text-bg font-bold'
                : 'bg-bg text-muted-fg hover:text-fg'
            }`}
            title="Compose: Will my draft get flagged? (prioritizes spam word minimization)"
          >
            <PenTool className="h-3 w-3" />
            <span>Compose</span>
          </button>
        </div>
      </div>
    </div>
  );
}
