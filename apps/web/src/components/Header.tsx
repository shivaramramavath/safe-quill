'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Moon,
  Sun,
  Shield,
  RotateCcw,
  Bookmark,
  User,
  Mail,
  Send,
  Sliders,
  Download,
  FileText,
  Code,
  Printer,
  ChevronDown,
  Settings,
  Check,
} from 'lucide-react';
import { useTheme } from './providers';
import { useDraftStore } from '@/store/useDraftStore';
import { saveDraftToAccount, exportTxt, exportEml, exportJson } from '@/lib/api';

interface HeaderProps {
  onClearClick: () => void;
}

export function Header({ onClearClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const {
    currentUser,
    subject,
    body,
    rawHeaders,
    analysisResult,
    savedSessions,
    setSavedSessions,
    inlineSuggestionsEnabled,
    setInlineSuggestionsEnabled,
    aiSuggestionsEnabled,
    setAiSuggestionsEnabled,
    setIsAuthModalOpen,
    setIsSavedDrawerOpen,
    setIsReportModalOpen,
    setIsAccountModalOpen,
    setIsAdminModalOpen,
  } = useDraftStore();

  const [savingAccount, setSavingAccount] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportTxt = async () => {
    setIsExporting(true);
    try {
      const res = await exportTxt({
        subject,
        body,
        score: analysisResult?.score,
        level: analysisResult?.level,
      });
      downloadFile(res.content, res.filename, res.contentType);
      setIsExportMenuOpen(false);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportEml = async () => {
    setIsExporting(true);
    try {
      const res = await exportEml({
        subject,
        body,
        from: currentUser?.email || 'guest@safequill.local',
        rawHeaders,
      });
      downloadFile(res.content, res.filename, res.contentType);
      setIsExportMenuOpen(false);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = async () => {
    setIsExporting(true);
    try {
      const res = await exportJson({
        subject,
        body,
        rawHeaders,
        analysisResult,
        timestamp: new Date().toISOString(),
      });
      downloadFile(res.content, res.filename, res.contentType);
      setIsExportMenuOpen(false);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveClick = async () => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }

    setSavingAccount(true);
    try {
      const saved = await saveDraftToAccount({
        subject,
        body,
        rawHeaders,
        analysisSnapshot: analysisResult
          ? {
              score: analysisResult.score,
              verdict: analysisResult.level,
              cuesCount: analysisResult.evidence?.length || 0,
              timestamp: new Date().toISOString(),
            }
          : undefined,
      });

      setSavedSessions([saved, ...savedSessions.filter((s) => s.id !== saved.id)]);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // Ignore
    } finally {
      setSavingAccount(false);
    }
  };

  return (
    <header className="w-full border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg)]/60 sticky top-0 z-40">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center border border-[var(--border)] bg-[var(--fg)] text-[var(--bg)]">
            <Shield className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-base sm:text-lg text-[var(--fg)]">SafeQuill</span>
              <span className="border border-current px-1.5 py-0.5 text-[10px] uppercase font-mono font-bold tracking-wider text-[var(--fg)]">
                v0.1
              </span>
            </div>
            <p className="hidden text-[11px] font-semibold text-[var(--fg)]/80 sm:block -mt-0.5">
              Phishing Detector & Email Security
            </p>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Single Sign In / Save Button (Requirement 1) */}
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={savingAccount}
            className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              saveSuccess
                ? 'border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]'
                : 'border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] hover:border-[var(--fg)]'
            }`}
            title={currentUser ? 'Save to your account' : 'Sign in to save this draft'}
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>{saveSuccess ? 'Saved!' : currentUser ? 'Save' : 'Sign in to save'}</span>
          </button>

          {/* Export Dropdown Menu with Email Option (Requirement 6) */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--fg)] hover:border-[var(--fg)] transition-colors"
              title="Export draft or email report"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 border border-[var(--border)] bg-[var(--bg)] shadow-lg z-50 text-xs py-1 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 font-mono text-[10px] uppercase text-[var(--muted)] border-b border-[var(--border)]">
                  Export Options
                </div>
                <button
                  type="button"
                  onClick={handleExportTxt}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--bg-subtle)] text-[var(--fg)] transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Plain Text (.txt)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportEml}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--bg-subtle)] text-[var(--fg)] transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>RFC 822 Email (.eml)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--bg-subtle)] text-[var(--fg)] transition-colors"
                >
                  <Code className="h-3.5 w-3.5" />
                  <span>JSON Audit Record (.json)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    setIsReportModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--bg-subtle)] text-[var(--fg)] transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Email me this report</span>
                </button>
                <div className="border-t border-[var(--border)] my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    window.print();
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--bg-subtle)] text-[var(--fg)] transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Summary</span>
                </button>
              </div>
            )}
          </div>

          {/* Settings Popover (Requirement 5) */}
          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              className="flex h-8 w-8 items-center justify-center border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--fg)] transition-colors text-[var(--fg)]"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>

            {isSettingsOpen && (
              <div className="absolute right-0 mt-1.5 w-60 border border-[var(--border)] bg-[var(--bg)] shadow-lg z-50 p-3 text-xs animate-in fade-in zoom-in-95 font-sans">
                <div className="font-mono text-[10px] uppercase font-bold text-muted-fg mb-2">
                  Settings
                </div>
                <div className="flex items-center justify-between py-1.5 border-t border-[var(--border)]">
                  <span className="font-medium text-xs">Inline suggestions</span>
                  <button
                    type="button"
                    onClick={() => setInlineSuggestionsEnabled(!inlineSuggestionsEnabled)}
                    className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border transition-colors ${
                      inlineSuggestionsEnabled
                        ? 'border-fg bg-fg text-bg'
                        : 'border-border bg-bg text-muted-fg'
                    }`}
                  >
                    {inlineSuggestionsEnabled ? 'On' : 'Off'}
                  </button>
                </div>
                <div className="flex items-center justify-between py-1.5 border-t border-[var(--border)]">
                  <span className="font-medium text-xs">AI suggestions (Groq)</span>
                  <button
                    type="button"
                    onClick={() => setAiSuggestionsEnabled(!aiSuggestionsEnabled)}
                    className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border transition-colors ${
                      aiSuggestionsEnabled
                        ? 'border-fg bg-fg text-bg'
                        : 'border-border bg-bg text-muted-fg'
                    }`}
                  >
                    {aiSuggestionsEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Saved Sessions Button (if signed in) */}
          {currentUser && (
            <button
              type="button"
              onClick={() => setIsSavedDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--fg)] hover:border-[var(--fg)] transition-colors"
              title="View your saved drafts"
            >
              <Mail className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Drafts</span>
              {savedSessions.length > 0 && (
                <span className="bg-[var(--fg)] text-[var(--bg)] px-1 text-[10px] font-mono">
                  {savedSessions.length}
                </span>
              )}
            </button>
          )}

          {/* User Account Pill (when signed in) */}
          {currentUser && (
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              className="inline-flex items-center gap-1.5 border border-[var(--border)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--fg)] hover:border-[var(--fg)] transition-colors"
              title="Account settings & GDPR"
            >
              <User className="h-3.5 w-3.5" />
              <span className="hidden md:inline max-w-[100px] truncate">{currentUser.email}</span>
            </button>
          )}

          {/* Admin Dashboard (admin role only) */}
          {currentUser?.role === 'admin' && (
            <button
              type="button"
              onClick={() => setIsAdminModalOpen(true)}
              className="inline-flex items-center gap-1.5 border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--fg)] hover:border-[var(--fg)] transition-colors"
              title="Admin & MLOps Dashboard"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Admin</span>
            </button>
          )}

          {/* Clear Button */}
          <button
            type="button"
            onClick={onClearClick}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--fg)] hover:border-[var(--fg)] transition-colors"
            title="Reset email draft"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          {/* Dark / Light Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--fg)] transition-colors"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4 text-[var(--fg)]" />
            ) : (
              <Sun className="h-4 w-4 text-[var(--fg)]" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
