'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  FileText,
  Sparkles,
  Check,
  Copy,
  Plus,
  ArrowRight,
  AlertTriangle,
  Loader2,
  Lock,
  Lightbulb,
} from 'lucide-react';
import { useDraftStore } from '../store/useDraftStore';
import { ScoreMeter } from './ScoreMeterPreview';
import { ExplanationsPanel } from './ExplanationsPanel';
import {
  requestGenerateDraft,
  requestSummarize,
  requestRewrite,
  requestSubjects,
} from '../lib/api';
import { GeneratedDraft, SummarizeResponse, SummaryMode } from '@safe-quill/shared';

const QUICK_TEMPLATES = [
  { name: 'Follow-up', prompt: 'Follow up on our previous conversation regarding the project timeline.' },
  { name: 'Meeting request', prompt: 'Request a 30-minute sync meeting to discuss next quarter goals.' },
  { name: 'Leave request', prompt: 'Submit a formal annual leave request for next week.' },
  { name: 'Invoice reminder', prompt: 'Polite reminder about the pending invoice due by the end of this week.' },
  { name: 'Complaint', prompt: 'Polite and firm complaint regarding delayed software delivery.' },
  { name: 'Thank you', prompt: 'Express sincere gratitude for the team assistance and successful launch.' },
  { name: 'Introduction', prompt: 'Introduce myself and my role as the new engineering lead.' },
  { name: 'Refund request', prompt: 'Request a refund for the duplicate subscription charge.' },
  { name: 'Job application', prompt: 'Submit an application for the Senior Software Engineer position.' },
  { name: 'Cold outreach', prompt: 'Non-spammy, relevant outreach to explore potential strategic partnership.' },
];

export function RightPanel() {
  const {
    body,
    subject,
    rawHeaders,
    analysisResult,
    isAnalyzing,
    activeRightTab,
    setActiveRightTab,
    setSubject,
    setBody,
  } = useDraftStore();

  // Summary State
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('tldr');
  const [safeSummary, setSafeSummary] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState<SummarizeResponse | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Generate State
  const [genPrompt, setGenPrompt] = useState('');
  const [genRecipient, setGenRecipient] = useState('');
  const [genTone, setGenTone] = useState('professional');
  const [genLength, setGenLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [genVariants, setGenVariants] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [generatedDrafts, setGeneratedDrafts] = useState<GeneratedDraft[]>([]);
  const [copiedDraftIdx, setCopiedDraftIdx] = useState<number | null>(null);

  // Subjects Generator State
  const [suggestingSubjects, setSuggestingSubjects] = useState(false);
  const [suggestedSubjects, setSuggestedSubjects] = useState<string[] | null>(null);

  // Summarize Handler
  const handleSummarize = async () => {
    if (!body.trim()) {
      alert('Please paste or type an email body to summarize.');
      return;
    }
    setSummaryLoading(true);
    try {
      const res = await requestSummarize({
        text: body,
        mode: summaryMode,
        safeSummary,
      });
      setSummaryResult(res);
    } catch (err: any) {
      alert(`Summary error: ${err.message}`);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Generate Handler
  const handleGenerate = async () => {
    if (!genPrompt.trim()) {
      alert('Please enter what you want to say or click a quick template.');
      return;
    }
    setGenLoading(true);
    try {
      const res = await requestGenerateDraft({
        prompt: genPrompt,
        recipient: genRecipient || undefined,
        tone: genTone || undefined,
        length: genLength,
        variants: genVariants,
        currentSubject: subject || undefined,
      });
      setGeneratedDrafts(res.drafts);

      // Auto-fill empty subject if draft has one
      if (!subject.trim() && res.drafts.length > 0 && res.drafts[0].subject) {
        setSubject(res.drafts[0].subject);
      }
    } catch (err: any) {
      alert(`Generation error: ${err.message}`);
    } finally {
      setGenLoading(false);
    }
  };

  // Suggest Subjects Handler
  const handleSuggestSubjects = async () => {
    const textToAnalyze = body.trim() || genPrompt.trim();
    if (!textToAnalyze) {
      alert('Please enter a draft or prompt first to generate subjects.');
      return;
    }
    setSuggestingSubjects(true);
    try {
      const res = await requestSubjects(textToAnalyze);
      setSuggestedSubjects(res.subjects);
    } catch (err: any) {
      alert(`Subject generation error: ${err.message}`);
    } finally {
      setSuggestingSubjects(false);
    }
  };

  // Insert Draft Handler
  const handleInsertDraft = (draft: GeneratedDraft) => {
    if (!subject.trim() && draft.subject) {
      setSubject(draft.subject);
    }
    setBody(draft.body);
  };

  const handleAppendDraft = (draft: GeneratedDraft) => {
    setBody(body ? `${body}\n\n${draft.body}` : draft.body);
    if (!subject.trim() && draft.subject) {
      setSubject(draft.subject);
    }
  };

  const handleCopyDraft = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedDraftIdx(idx);
    setTimeout(() => setCopiedDraftIdx(null), 2000);
  };

  // Fix with Safe Rewrite
  const handleSafeRewriteDraft = async (draftIdx: number) => {
    const target = generatedDrafts[draftIdx];
    try {
      const res = await requestRewrite({
        subject: target.subject,
        body: target.body,
        mode: 'safe',
      });
      const updated = [...generatedDrafts];
      updated[draftIdx] = {
        ...target,
        body: res.rewrittenText,
        score: res.newScore,
        level: res.newLevel,
        isSpam: res.newLevel === 'HIGH',
      };
      setGeneratedDrafts(updated);
    } catch (err: any) {
      alert(`Safe rewrite failed: ${err.message}`);
    }
  };

  // Clarity score calculation (Flesch-Kincaid heuristic)
  const calculateClarityScore = () => {
    if (!body.trim()) return 100;
    const words = body.trim().split(/\s+/).length;
    const sentences = body.split(/[.!?]+/).filter(Boolean).length || 1;
    const avgWordsPerSentence = words / sentences;
    if (avgWordsPerSentence <= 14) return 92;
    if (avgWordsPerSentence <= 20) return 78;
    if (avgWordsPerSentence <= 28) return 60;
    return 45;
  };

  // Detected Intent calculation
  const getDetectedIntent = () => {
    if (!body.trim()) return 'None';
    if (analysisResult?.level === 'HIGH') return 'High-Risk Phishing / Credential Lure';
    if (/(invoice|wire|payment|bank|fee|due)/i.test(body)) return 'Financial / Transactional';
    if (/(urgent|immediate|suspend|warning)/i.test(body)) return 'Urgent Action Request';
    if (/(meeting|sync|schedule|calendar)/i.test(body)) return 'Scheduling / Collaboration';
    return 'General Information Exchange';
  };

  const clarity = calculateClarityScore();
  const intent = getDetectedIntent();

  return (
    <div className="flex flex-col rounded-lg border border-border bg-bg shadow-sm overflow-hidden h-full">
      {/* 4 Tab Navigation Header: Verdict, Summary, Generate, Details */}
      <div className="flex items-center border-b border-border bg-muted/20 text-xs font-mono">
        <button
          type="button"
          onClick={() => setActiveRightTab('verdict')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 font-semibold transition-colors border-r border-border ${
            activeRightTab === 'verdict'
              ? 'bg-bg text-fg border-b-2 border-b-fg'
              : 'text-muted-fg hover:text-fg'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Verdict</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveRightTab('summary')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 font-semibold transition-colors border-r border-border ${
            activeRightTab === 'summary'
              ? 'bg-bg text-fg border-b-2 border-b-fg'
              : 'text-muted-fg hover:text-fg'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Summary</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveRightTab('generate')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 font-semibold transition-colors border-r border-border ${
            activeRightTab === 'generate'
              ? 'bg-bg text-fg border-b-2 border-b-fg'
              : 'text-muted-fg hover:text-fg'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Generate</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveRightTab('details')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 font-semibold transition-colors ${
            activeRightTab === 'details'
              ? 'bg-bg text-fg border-b-2 border-b-fg'
              : 'text-muted-fg hover:text-fg'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Details</span>
        </button>
      </div>

      {/* Tab Content Container */}
      <div className="p-4 flex-1 overflow-y-auto max-h-[750px]">
        {/* ======================================================== */}
        {/* TAB 1: VERDICT OVERVIEW */}
        {/* ======================================================== */}
        {activeRightTab === 'verdict' && (
          <div className="flex flex-col gap-4">
            <ScoreMeter
              score={analysisResult?.score ?? 0}
              level={analysisResult?.level ?? 'LOW'}
              isAnalyzing={isAnalyzing}
              latencyMs={analysisResult?.latencyMs}
              cached={analysisResult?.cached}
              modelVersion={analysisResult?.modelVersion}
              topTokens={analysisResult?.topTokens}
              evidenceCount={analysisResult?.evidence?.length ?? 0}
            />

            {/* Clarity, Tone & Intent Badges */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="border border-border p-2 bg-muted/10 rounded">
                <span className="text-[10px] uppercase text-muted-fg block">Clarity Score</span>
                <span className="font-bold text-sm">{clarity}/100</span>
                <span className="text-[10px] text-muted-fg block">
                  {clarity >= 80 ? 'Crisp & readable' : 'Complex sentences'}
                </span>
              </div>
              <div className="border border-border p-2 bg-muted/10 rounded">
                <span className="text-[10px] uppercase text-muted-fg block">Detected Intent</span>
                <span className="font-bold text-xs truncate block" title={intent}>
                  {intent}
                </span>
                <span className="text-[10px] text-muted-fg block">
                  {analysisResult?.level === 'HIGH'
                    ? 'Critical threat'
                    : analysisResult?.level === 'MEDIUM'
                    ? 'Caution advised'
                    : 'Standard'}
                </span>
              </div>
            </div>

            {/* Verdict Status Message: strictly follows verdict (Bonus fix) */}
            {analysisResult?.level === 'HIGH' ? (
              <div className="border border-accent-high/50 p-4 text-xs font-mono bg-accent-high/10 rounded space-y-1 text-accent-high">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  <span>High Risk Security Alert ({analysisResult.score}/100)</span>
                </div>
                <div>Critical threat patterns detected. Do not click links, open attachments, or disclose sensitive credentials. View Details tab for full breakdown.</div>
              </div>
            ) : analysisResult?.level === 'MEDIUM' ? (
              <div className="border border-border p-4 text-xs font-mono bg-muted/20 rounded space-y-1">
                <div className="font-bold text-fg flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-fg" />
                  <span>Elevated Risk Assessment ({analysisResult.score}/100)</span>
                </div>
                <div className="text-muted-fg">Statistical model flagged heightened risk indicators based on vocabulary and tone structure. Exercise caution before trusting payment or link requests.</div>
              </div>
            ) : (
              <div className="border border-dashed border-border p-4 text-center text-xs text-muted-fg font-mono">
                No active threats detected. Email content appears legitimate.
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: SUMMARY PANEL */}
        {/* ======================================================== */}
        {activeRightTab === 'summary' && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-mono uppercase text-muted-fg mb-1">
                Summary Mode
              </label>
              <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
                {(['tldr', 'short', 'detailed', 'action_items', 'key_facts'] as SummaryMode[]).map(
                  (m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSummaryMode(m)}
                      className={`p-1.5 border rounded text-center transition-colors ${
                        summaryMode === m
                          ? 'border-fg bg-fg text-bg font-bold'
                          : 'border-border hover:border-fg'
                      }`}
                    >
                      {m === 'tldr'
                        ? 'TL;DR (1 Line)'
                        : m === 'short'
                        ? '3 Bullets'
                        : m === 'detailed'
                        ? 'Detailed'
                        : m === 'action_items'
                        ? 'Actions'
                        : 'Key Facts'}
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Safe Summary Toggle */}
            <div className="flex items-center gap-2 border border-border p-2 rounded bg-muted/10 text-xs">
              <input
                id="safe-summary-chk"
                type="checkbox"
                checked={safeSummary}
                onChange={(e) => setSafeSummary(e.target.checked)}
                className="cursor-pointer"
              />
              <label htmlFor="safe-summary-chk" className="cursor-pointer flex items-center gap-1 font-mono text-[11px]">
                <Lock className="h-3 w-3 text-muted-fg" />
                <span>Safe summary (neutralize links, phone numbers & payment cues)</span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleSummarize}
              disabled={summaryLoading || !body.trim()}
              className="w-full py-2 bg-fg text-bg font-bold font-mono text-xs rounded hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-1.5"
            >
              {summaryLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              <span>{summaryLoading ? 'Generating Summary...' : 'Generate Summary'}</span>
            </button>

            {/* Summary Output */}
            {summaryResult && (
              <div className="border border-border rounded p-3 bg-muted/10 text-xs flex flex-col gap-2 font-sans mt-2 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-border pb-1 font-mono text-[10px] text-muted-fg">
                  <span>Intent: {summaryResult.intent}</span>
                  <span>Tone: {summaryResult.tone}</span>
                  <span>~{summaryResult.readingTimeMin}m read</span>
                </div>

                <div className="whitespace-pre-wrap leading-relaxed text-sm font-medium">
                  {summaryResult.summary}
                </div>

                {summaryResult.safetyNote && (
                  <div className="border-t border-border pt-1.5 font-mono text-[11px] text-muted-fg">
                    <strong>Safety Note:</strong> {summaryResult.safetyNote}
                  </div>
                )}

                {summaryResult.actionItems && summaryResult.actionItems.length > 0 && (
                  <div className="border-t border-border pt-2 flex flex-col gap-1 font-mono text-xs">
                    <span className="font-bold uppercase text-[10px] text-muted-fg">Action Items:</span>
                    {summaryResult.actionItems.map((item, idx) => (
                      <div key={idx} className="p-1 border border-border bg-bg rounded">
                        <span className="font-semibold">{item.task}</span>
                        {item.owner && <span className="text-muted-fg ml-1">({item.owner})</span>}
                        {item.deadline && <span className="text-[10px] block text-muted-fg">Due: {item.deadline}</span>}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(summaryResult.summary);
                    setCopiedSummary(true);
                    setTimeout(() => setCopiedSummary(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-mono border border-border px-2 py-1 hover:border-fg self-start mt-1"
                >
                  {copiedSummary ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedSummary ? 'Copied' : 'Copy Summary'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: GENERATE PANEL */}
        {/* ======================================================== */}
        {activeRightTab === 'generate' && (
          <div className="flex flex-col gap-3">
            {/* Suggest Subjects (Moved from toolbar per Requirement 4) */}
            <div className="border border-border p-2.5 rounded bg-muted/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-fg flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-muted-fg" />
                  <span>Subject Generator</span>
                </span>
                <button
                  type="button"
                  onClick={handleSuggestSubjects}
                  disabled={suggestingSubjects || (!body.trim() && !genPrompt.trim())}
                  className="font-mono text-[11px] px-2 py-0.5 border border-border rounded bg-bg hover:border-fg disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  {suggestingSubjects ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  <span>Suggest subjects</span>
                </button>
              </div>

              {suggestedSubjects && suggestedSubjects.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {suggestedSubjects.map((sub, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setSubject(sub);
                        setSuggestedSubjects(null);
                      }}
                      className="text-[11px] font-medium border border-border bg-bg px-2 py-0.5 rounded hover:border-fg text-left transition-colors"
                      title="Click to apply this subject"
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Templates */}
            <div>
              <span className="block text-[10px] font-mono uppercase text-muted-fg mb-1">
                Quick Templates
              </span>
              <div className="flex flex-wrap gap-1">
                {QUICK_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.name}
                    type="button"
                    onClick={() => setGenPrompt(tmpl.prompt)}
                    className="text-[10px] font-mono border border-border px-1.5 py-0.5 rounded hover:border-fg hover:bg-muted/30 transition-colors"
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Input */}
            <div>
              <label htmlFor="gen-prompt" className="block text-xs font-mono uppercase text-muted-fg mb-1">
                What do you want to say?
              </label>
              <textarea
                id="gen-prompt"
                rows={3}
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                placeholder="e.g. Ask client for the signed NDA and schedule kickoff meeting..."
                className="w-full text-xs font-sans p-2 rounded border border-border bg-bg placeholder:text-muted-fg/60 focus:outline-none focus:border-fg"
              />
            </div>

            {/* Three Optional Fields */}
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div>
                <label className="block text-[10px] uppercase text-muted-fg mb-0.5">Recipient</label>
                <select
                  value={genRecipient}
                  onChange={(e) => setGenRecipient(e.target.value)}
                  className="w-full p-1 border border-border bg-bg rounded text-[11px]"
                >
                  <option value="">(General)</option>
                  <option value="boss">Boss</option>
                  <option value="client">Client</option>
                  <option value="HR">HR</option>
                  <option value="vendor">Vendor</option>
                  <option value="support">Support</option>
                  <option value="friend">Friend</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-muted-fg mb-0.5">Tone</label>
                <select
                  value={genTone}
                  onChange={(e) => setGenTone(e.target.value)}
                  className="w-full p-1 border border-border bg-bg rounded text-[11px]"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="formal">Formal</option>
                  <option value="persuasive">Persuasive</option>
                  <option value="apologetic">Apologetic</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-muted-fg mb-0.5">Length</label>
                <select
                  value={genLength}
                  onChange={(e) => setGenLength(e.target.value as any)}
                  className="w-full p-1 border border-border bg-bg rounded text-[11px]"
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </div>
            </div>

            {/* Single vs 3 Variants Toggle */}
            <div className="flex items-center justify-between text-xs font-mono py-1">
              <span>Variants:</span>
              <button
                type="button"
                onClick={() => setGenVariants(!genVariants)}
                className="px-2 py-0.5 border border-border rounded hover:border-fg"
              >
                {genVariants ? '3 Variants' : '1 Draft'}
              </button>
            </div>

            {/* Generate Action Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={genLoading || !genPrompt.trim()}
              className="w-full py-2 bg-fg text-bg font-bold font-mono text-xs rounded hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-1.5"
            >
              {genLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>{genLoading ? 'Composing Drafts...' : genVariants ? 'Generate 3 Variants' : 'Generate Draft'}</span>
            </button>

            {/* Generated Draft Cards */}
            {generatedDrafts.length > 0 && (
              <div className="flex flex-col gap-3 mt-2">
                <span className="font-mono text-[10px] uppercase font-bold text-muted-fg">
                  Generated Drafts ({generatedDrafts.length}):
                </span>
                {generatedDrafts.map((draft, idx) => (
                  <div key={idx} className="border border-border rounded p-3 bg-muted/10 text-xs flex flex-col gap-2 font-sans">
                    {/* Header with Risk Score Before Insertion */}
                    <div className="flex items-center justify-between font-mono text-[10px] border-b border-border pb-1">
                      <span className="font-bold">Variant {idx + 1}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded border ${
                          draft.level === 'HIGH'
                            ? 'border-accent-high text-accent-high bg-accent-high/10'
                            : draft.level === 'MEDIUM'
                            ? 'border-fg text-fg bg-fg/10'
                            : 'border-border text-muted-fg'
                        }`}
                      >
                        Risk: {draft.score}/100 ({draft.level})
                      </span>
                    </div>

                    {draft.subject && (
                      <div className="font-mono text-xs">
                        <strong>Subject:</strong> {draft.subject}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap leading-relaxed text-xs">
                      {draft.body}
                    </div>

                    {/* Actions: Insert, Append, Copy, Fix Safe */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border font-mono text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleInsertDraft(draft)}
                        className="px-2 py-0.5 border border-fg bg-fg text-bg rounded font-semibold hover:opacity-90 flex items-center gap-1"
                        title="Replace current email body"
                      >
                        <ArrowRight className="h-3 w-3" />
                        <span>Insert</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAppendDraft(draft)}
                        className="px-2 py-0.5 border border-border rounded hover:border-fg flex items-center gap-1"
                        title="Append to existing body"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Append</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyDraft(draft.body, idx)}
                        className="px-2 py-0.5 border border-border rounded hover:border-fg flex items-center gap-1"
                      >
                        {copiedDraftIdx === idx ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedDraftIdx === idx ? 'Copied' : 'Copy'}</span>
                      </button>
                      {(draft.level === 'MEDIUM' || draft.level === 'HIGH') && (
                        <button
                          type="button"
                          onClick={() => handleSafeRewriteDraft(idx)}
                          className="px-2 py-0.5 border border-border rounded hover:border-fg text-muted-fg hover:text-fg ml-auto"
                        >
                          Fix with Safe Rewrite
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: DETAILS & EVIDENCE PANEL */}
        {/* ======================================================== */}
        {activeRightTab === 'details' && (
          <div className="flex flex-col gap-4">
            <div className="font-mono text-xs text-muted-fg">
              Detailed security detector inspections, authentication results, and threat heuristics:
            </div>
            {analysisResult?.evidence && analysisResult.evidence.length > 0 ? (
              <ExplanationsPanel evidence={analysisResult.evidence} />
            ) : (
              <div className="border border-dashed border-border p-4 text-center text-xs text-muted-fg font-mono">
                No active threats or suspicious indicators found. All heuristic checks passed.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
