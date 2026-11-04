'use client';

import React, { useState } from 'react';
import { Moon, Sun, Shield, RotateCcw, Bookmark, User, Mail, Send } from 'lucide-react';
import { useTheme } from './providers';
import { useDraftStore } from '@/store/useDraftStore';
import { saveDraftToAccount } from '@/lib/api';

interface HeaderProps {
  onClearClick: () => void;
  wordCount: number;
  charCount: number;
}

export function Header({ onClearClick, wordCount, charCount }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const {
    currentUser,
    subject,
    body,
    rawHeaders,
    analysisResult,
    savedSessions,
    setSavedSessions,
    setIsAuthModalOpen,
    setIsSavedDrawerOpen,
    setIsReportModalOpen,
    setIsAccountModalOpen,
  } = useDraftStore();

  const [savingAccount, setSavingAccount] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
              <span className="border border-[var(--border)] px-1.5 py-0.2 text-[10px] uppercase font-mono tracking-wider text-[var(--muted)]">
                v0.1
              </span>
            </div>
            <p className="hidden text-[11px] text-[var(--muted)] sm:block -mt-1">
              Phishing Detector & Email Security
            </p>
          </div>
        </div>

        {/* Center stats */}
        <div className="hidden md:flex items-center gap-3 text-xs font-mono text-[var(--muted)] border border-[var(--border)] px-3 py-1 bg-[var(--bg-subtle)]">
          <span>{wordCount} words</span>
          <span className="text-[var(--border)]">|</span>
          <span>{charCount} chars</span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Save Draft Button */}
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
            <span>{saveSuccess ? 'Saved!' : currentUser ? 'Save' : 'Save Draft'}</span>
          </button>

          {/* Email Report Button */}
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--fg)] hover:border-[var(--fg)] transition-colors"
            title="Email security audit report"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Report</span>
          </button>

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

          {/* User Account / Sign In */}
          {currentUser ? (
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              className="inline-flex items-center gap-1.5 border border-[var(--border)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--fg)] hover:border-[var(--fg)] transition-colors"
              title="Account settings & GDPR"
            >
              <User className="h-3.5 w-3.5" />
              <span className="hidden md:inline max-w-[100px] truncate">{currentUser.email}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="inline-flex items-center gap-1.5 border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-semibold text-[var(--fg)] hover:border-[var(--fg)] transition-colors"
            >
              Sign In
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
