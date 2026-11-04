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
  Mic,
  MicOff,
  Upload,
  Paperclip,
  X,
} from 'lucide-react';
import { useDraftStore } from '../store/useDraftStore';
import {
  fetchCurrentSession,
  saveDraft,
  analyzeEmail,
  analyzeEml,
  requestSubjects,
  streamRewriteEmail,
} from '../lib/api';
import { countWordsAndChars } from '../lib/utils';
import { AiToolbar } from './AiToolbar';
import { DiffModal } from './DiffModal';
import { EditorSkeleton } from './Skeleton';
import { RewriteEmailResponse, RewriteMode } from '@safe-quill/shared';

export function Editor() {
  const {
    subject,
    body,
    rawHeaders,
    saveStatus,
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
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAction, setAiAction] = useState<string | undefined>();
  const [diffModalData, setDiffModalData] = useState<RewriteEmailResponse | null>(null);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestedSubjects, setSuggestedSubjects] = useState<string[] | null>(null);

  // Phase 7: Dictation and .eml upload states
  const [isListening, setIsListening] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [emlLoading, setEmlLoading] = useState(false);
  const [parsedAttachments, setParsedAttachments] = useState<any[]>([]);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Phase 7: Initialize Web Speech API for voice dictation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((res: any) => res[0].transcript)
            .join(' ');
          const currentSubj = useDraftStore.getState().subject;
          const currentHeaders = useDraftStore.getState().rawHeaders;
          const currentBody = useDraftStore.getState().body;
          const newBody = currentBody ? `${currentBody} ${transcript}` : transcript;
          setBody(newBody);
          triggerAutosave(currentSubj, newBody, currentHeaders);
          triggerAnalysis(currentSubj, newBody, currentHeaders);
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [triggerAnalysis, triggerAutosave, setBody]);

  const toggleDictation = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported in this browser. Please try Chrome or Edge.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Dictation error:', err);
      }
    }
  };

  const handleEmlUpload = async (file: File) => {
    setEmlLoading(true);
    try {
      const content = await file.text();
      const result = await analyzeEml(content);
      if (result.parsedEml) {
        const parsed = result.parsedEml;
        const newSubj = parsed.subject || '';
        const newBody = parsed.body || '';
        const newHeaders = parsed.rawHeaders || '';
        setSubject(newSubj);
        setBody(newBody);
        setRawHeaders(newHeaders);
        setParsedAttachments(parsed.attachments || []);
        setAnalysisResult(result);
        triggerAutosave(newSubj, newBody, newHeaders);
      }
    } catch (err: any) {
      alert(`Failed to import .eml: ${err.message}`);
    } finally {
      setEmlLoading(false);
    }
  };

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

  // AI Assistant Real-Time Streaming Rewrite
  const handleAiRewrite = async (mode: RewriteMode) => {
    setAiLoading(true);
    setAiAction(mode);
    setStreamingText('');
    setIsStreaming(true);
    setIsDiffOpen(true);

    // Initial placeholder so modal can show comparison context
    setDiffModalData({
      originalText: body,
      rewrittenText: '',
      explanation: 'LangGraph streaming safety check in progress...',
      mode,
      originalScore: 0,
      newScore: 0,
      originalLevel: 'LOW',
      newLevel: 'LOW',
      provider: 'LangGraph Stream',
    });

    await streamRewriteEmail(
      { subject, body, mode },
      (token) => {
        setStreamingText((prev) => prev + token);
      },
      (completeData) => {
        setDiffModalData(completeData);
        setStreamingText(completeData.rewrittenText);
        setIsStreaming(false);
        setAiLoading(false);
        setAiAction(undefined);
      },
      (errorMsg) => {
        alert(`AI Streaming Error: ${errorMsg}`);
        setIsStreaming(false);
        setAiLoading(false);
        setAiAction(undefined);
        setIsDiffOpen(false);
      },
    );
  };

  const handleSuggestSubjects = async () => {
    setAiLoading(true);
    setAiAction('subjects');
    try {
      const res = await requestSubjects(body);
      setSuggestedSubjects(res.subjects);
    } catch (err: any) {
      alert(`Subject Generator Error: ${err.message}`);
    } finally {
      setAiLoading(false);
      setAiAction(undefined);
    }
  };

  const handleAcceptDiff = (newBodyText: string) => {
    let newSubjectText = subject;
    if (diffModalData?.mode === 'safe') {
      newSubjectText = 'Notice: Account Review Information';
      setSubject(newSubjectText);
    }

    setBody(newBodyText);
    triggerAutosave(newSubjectText, newBodyText, rawHeaders);
    triggerAnalysis(newSubjectText, newBodyText, rawHeaders);
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
    return <EditorSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Editor Container with Drag-and-Drop for .eml */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleEmlUpload(e.dataTransfer.files[0]);
          }
        }}
        className={`rounded-lg border bg-bg shadow-sm overflow-hidden focus-within:border-fg transition-all relative ${
          isDragOver ? 'border-dashed border-2 border-fg bg-muted/20' : 'border-border'
        }`}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-bg/85 backdrop-blur-sm pointer-events-none">
            <Upload className="h-8 w-8 text-fg animate-bounce mb-2" />
            <p className="font-mono text-sm font-semibold text-fg">Drop RFC 822 .eml file here to parse & inspect</p>
          </div>
        )}

        {/* Top AI Action Bar */}
        <AiToolbar
          onRewrite={handleAiRewrite}
          onSuggestSubjects={handleSuggestSubjects}
          isLoading={aiLoading}
          activeAction={aiAction}
          hasContent={body.trim().length > 0}
        />

        {/* Suggested Subjects Pill Panel */}
        {suggestedSubjects && (
          <div className="border-b border-border bg-muted/30 px-4 py-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-muted-fg font-semibold uppercase text-[10px]">
              Click to Apply Subject:
            </span>
            {suggestedSubjects.map((sub, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setSubject(sub);
                  triggerAutosave(sub, body, rawHeaders);
                  triggerAnalysis(sub, body, rawHeaders);
                  setSuggestedSubjects(null);
                }}
                className="font-medium rounded border border-border bg-bg px-2 py-0.5 hover:border-fg transition-colors text-left"
              >
                {sub}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSuggestedSubjects(null)}
              className="text-[10px] text-muted-fg hover:text-fg ml-auto"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* History & Tools Toolbar */}
        <div className="flex items-center justify-between border-b border-border bg-muted/10 px-3 py-1.5 text-xs">
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
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-opacity"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3 w-3" />
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
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-opacity"
              title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            >
              <Redo2 className="h-3 w-3" />
              <span className="hidden sm:inline">Redo</span>
            </button>

            <span className="text-border mx-1">|</span>

            {/* Voice Dictation (Web Speech API) */}
            <button
              type="button"
              onClick={toggleDictation}
              className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 transition-colors ${
                isListening
                  ? 'bg-fg text-bg font-semibold'
                  : 'hover:bg-muted text-muted-fg hover:text-fg'
              }`}
              title={isListening ? 'Stop Voice Dictation' : 'Start Voice Dictation (Speech-to-Text)'}
            >
              {isListening ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-high opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-high"></span>
                  </span>
                  <MicOff className="h-3 w-3" />
                  <span>Listening...</span>
                </>
              ) : (
                <>
                  <Mic className="h-3 w-3" />
                  <span className="hidden sm:inline">Dictate</span>
                </>
              )}
            </button>

            {/* Import .eml File */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={emlLoading}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-muted disabled:opacity-30 text-muted-fg hover:text-fg transition-colors"
              title="Upload and analyze raw RFC 822 .eml file"
            >
              {emlLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">Import .eml</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".eml,.txt,message/rfc822"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleEmlUpload(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
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

        {/* Phase 7: Detected Attachments Banner */}
        {parsedAttachments.length > 0 && (
          <div className="border-b border-border bg-muted/30 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Paperclip className="h-3.5 w-3.5 text-accent-high" />
              <span className="font-semibold text-fg">
                Detected MIME Attachments ({parsedAttachments.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {parsedAttachments.map((att, idx) => (
                  <span
                    key={idx}
                    className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-border bg-bg"
                    title={`MIME: ${att.mimeType || 'unknown'} | SHA-256: ${att.sha256}`}
                  >
                    {att.filename}
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setParsedAttachments([])}
              className="text-muted-fg hover:text-fg text-xs"
              title="Dismiss attachment banner"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

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

      {/* Real-time Streaming Diff / Comparison Modal */}
      <DiffModal
        isOpen={isDiffOpen}
        rewriteData={diffModalData}
        streamingText={streamingText}
        isStreaming={isStreaming}
        onClose={() => {
          setIsDiffOpen(false);
          setIsStreaming(false);
          setStreamingText('');
        }}
        onAccept={handleAcceptDiff}
      />
    </div>
  );
}
