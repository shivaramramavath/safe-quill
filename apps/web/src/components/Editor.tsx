'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Undo2,
  Redo2,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useDraftStore } from '../store/useDraftStore';
import { fetchCurrentSession, saveDraft, analyzeEmail } from '../lib/api';
import { countWordsAndChars } from '../lib/utils';

export function Editor() {
  const {
    subject,
    body,
    rawHeaders,
    saveStatus,
    undoStack,
    redoStack,
    setSubject,
    setBody,
    setRawHeaders,
    setSaveStatus,
    setAnalysisResult,
    setIsAnalyzing,
    hydrateFromServer,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useDraftStore();

  const [showHeaders, setShowHeaders] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const analyzeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const isHydratedRef = useRef(false);

  // Trigger debounced analysis with request cancellation
  const triggerAnalysis = useCallback(
    (subj: string, bdy: string, hdrs?: string) => {
      if (analyzeTimeoutRef.current) {
        clearTimeout(analyzeTimeoutRef.current);
      }

      if (!subj.trim() && !bdy.trim()) {
        setAnalysisResult(null);
        setIsAnalyzing(false);
        return;
      }

      setIsAnalyzing(true);

      analyzeTimeoutRef.current = setTimeout(async () => {
        // Cancel in-flight request if user is still typing
        if (analysisAbortRef.current) {
          analysisAbortRef.current.abort();
        }

        const controller = new AbortController();
        analysisAbortRef.current = controller;

        try {
          const result = await analyzeEmail(
            { subject: subj, body: bdy, rawHeaders: hdrs },
            controller.signal,
          );
          setAnalysisResult(result);
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.warn('Real-time analysis error:', err);
          }
        } finally {
          setIsAnalyzing(false);
        }
      }, 500);
    },
    [setAnalysisResult, setIsAnalyzing],
  );

  // Hydrate draft from guest session on initial load and analyze
  useEffect(() => {
    let mounted = true;
    async function loadSession() {
      try {
        const session = await fetchCurrentSession();
        if (mounted && session?.draft) {
          hydrateFromServer(session.draft);
          isHydratedRef.current = true;
          if (session.draft.subject || session.draft.body) {
            triggerAnalysis(session.draft.subject, session.draft.body, session.draft.rawHeaders);
          }
        }
      } catch (err) {
        console.warn('Initial session fetch notice:', err);
      } finally {
        if (mounted) {
          setInitialLoading(false);
          isHydratedRef.current = true;
        }
      }
    }
    loadSession();
    return () => {
      mounted = false;
      if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current);
      if (analysisAbortRef.current) analysisAbortRef.current.abort();
    };
  }, [hydrateFromServer, triggerAnalysis]);

  // Debounced autosave
  const triggerAutosave = useCallback(
    (subj: string, bdy: string, hdrs?: string) => {
      if (!isHydratedRef.current) return;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      setSaveStatus('saving');

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await saveDraft({
            subject: subj,
            body: bdy,
            rawHeaders: hdrs,
          });
          setSaveStatus('saved', res.draft.updatedAt);
        } catch {
          setSaveStatus('error');
        }
      }, 500);
    },
    [setSaveStatus],
  );

  const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSubject(val);
    triggerAutosave(val, body, rawHeaders);
    triggerAnalysis(val, body, rawHeaders);
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);
    triggerAutosave(subject, val, rawHeaders);
    triggerAnalysis(subject, val, rawHeaders);
  };

  const handleHeadersChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawHeaders(val);
    triggerAutosave(subject, body, val);
    triggerAnalysis(subject, body, val);
  };

  // Keyboard undo/redo handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      if (e.shiftKey) {
        e.preventDefault();
        if (canRedo()) {
          redo();
          const { subject: s, body: b, rawHeaders: h } = useDraftStore.getState();
          triggerAutosave(s, b, h);
          triggerAnalysis(s, b, h);
        }
      } else {
        e.preventDefault();
        if (canUndo()) {
          undo();
          const { subject: s, body: b, rawHeaders: h } = useDraftStore.getState();
          triggerAutosave(s, b, h);
          triggerAnalysis(s, b, h);
        }
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      if (canRedo()) {
        redo();
        const { subject: s, body: b, rawHeaders: h } = useDraftStore.getState();
        triggerAutosave(s, b, h);
        triggerAnalysis(s, b, h);
      }
    }
  };

  const counts = countWordsAndChars(body);

  if (initialLoading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-border bg-muted/10">
        <div className="flex items-center gap-2 text-sm text-muted-fg font-mono">
          <Loader2 className="h-4 w-4 animate-spin text-fg" />
          <span>Restoring guest session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Editor Container */}
      <div className="rounded-lg border border-border bg-bg shadow-sm overflow-hidden focus-within:border-fg transition-colors">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-2 text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                undo();
                const { subject: s, body: b, rawHeaders: h } = useDraftStore.getState();
                triggerAutosave(s, b, h);
                triggerAnalysis(s, b, h);
              }}
              disabled={!canUndo()}
              className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-opacity"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Undo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                redo();
                const { subject: s, body: b, rawHeaders: h } = useDraftStore.getState();
                triggerAutosave(s, b, h);
                triggerAnalysis(s, b, h);
              }}
              disabled={!canRedo()}
              className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-opacity"
              title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            >
              <Redo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Redo</span>
            </button>
          </div>

          {/* Autosave status indicator */}
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-fg">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-fg">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Saving draft...</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-fg" />
                <span>Saved to guest session</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-accent-high">
                <AlertTriangle className="h-3 w-3" />
                <span>Save failed (reconnecting)</span>
              </span>
            )}
            {saveStatus === 'idle' && <span>Ready</span>}
          </div>
        </div>

        {/* Subject Input */}
        <div className="border-b border-border px-4 py-3">
          <label htmlFor="email-subject" className="block text-xs font-mono text-muted-fg uppercase mb-1">
            Subject
          </label>
          <input
            id="email-subject"
            type="text"
            value={subject}
            onChange={handleSubjectChange}
            placeholder="e.g. Urgent: Account Verification Required"
            className="w-full bg-transparent text-sm sm:text-base font-semibold placeholder:text-muted-fg/60 focus:outline-none"
            maxLength={500}
          />
        </div>

        {/* Body Textarea */}
        <div className="px-4 py-3">
          <label htmlFor="email-body" className="block text-xs font-mono text-muted-fg uppercase mb-1">
            Email Body
          </label>
          <textarea
            id="email-body"
            rows={12}
            value={body}
            onChange={handleBodyChange}
            onKeyDown={handleKeyDown}
            placeholder="Paste or type the full email content here to inspect spam & phishing risk..."
            className="w-full resize-y bg-transparent text-sm leading-relaxed placeholder:text-muted-fg/60 focus:outline-none font-sans min-h-[220px]"
          />
        </div>

        {/* Live Bottom Bar */}
        <div className="flex flex-wrap items-center justify-between border-t border-border bg-muted/10 px-4 py-2 text-xs font-mono text-muted-fg">
          <div className="flex items-center gap-3">
            <span>{counts.words} words</span>
            <span>{counts.chars} characters</span>
            <span className="hidden sm:inline">~{Math.ceil(counts.words / 200)} min read</span>
          </div>

          <button
            type="button"
            onClick={() => setShowHeaders(!showHeaders)}
            className="inline-flex items-center gap-1 text-[11px] hover:text-fg transition-colors"
          >
            {showHeaders ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <span>{showHeaders ? 'Hide raw headers' : 'Add raw headers (optional)'}</span>
          </button>
        </div>

        {/* Optional Raw Headers Accordion */}
        {showHeaders && (
          <div className="border-t border-border bg-muted/30 p-4 transition-all">
            <label
              htmlFor="raw-headers"
              className="block text-xs font-mono uppercase text-muted-fg mb-1"
            >
              Raw Email Headers (Received, Authentication-Results, SPF/DKIM/DMARC)
            </label>
            <textarea
              id="raw-headers"
              rows={4}
              value={rawHeaders}
              onChange={handleHeadersChange}
              placeholder="Paste RFC 5322 raw headers here..."
              className="w-full font-mono text-xs bg-bg border border-border rounded p-2.5 placeholder:text-muted-fg/50 focus:outline-none focus:border-fg"
            />
          </div>
        )}
      </div>
    </div>
  );
}
