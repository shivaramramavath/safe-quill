'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { GuestBanner } from '../components/GuestBanner';
import { Editor } from '../components/Editor';
import { ScoreMeter } from '../components/ScoreMeterPreview';
import { ExplanationsPanel } from '../components/ExplanationsPanel';
import { ClearModal } from '../components/ClearModal';
import { AuthModal } from '../components/AuthModal';
import { SavedSessionsDrawer } from '../components/SavedSessionsDrawer';
import { EmailReportModal } from '../components/EmailReportModal';
import { AccountSettingsModal } from '../components/AccountSettingsModal';
import { useDraftStore } from '../store/useDraftStore';
import { clearSessionDraft, fetchCurrentUser, fetchSavedSessions } from '../lib/api';
import { countWordsAndChars } from '../lib/utils';

export default function Home() {
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const {
    body,
    analysisResult,
    isAnalyzing,
    resetDraft,
    setCurrentUser,
    setSavedSessions,
  } = useDraftStore();

  const counts = countWordsAndChars(body);

  useEffect(() => {
    // Check if user has an active authenticated session
    fetchCurrentUser()
      .then((data) => {
        if (data?.user) {
          setCurrentUser(data.user);
          fetchSavedSessions().then((sessions) => setSavedSessions(sessions));
        }
      })
      .catch(() => {
        // Guest user
      });
  }, [setCurrentUser, setSavedSessions]);

  const handleConfirmClear = async () => {
    try {
      await clearSessionDraft();
      resetDraft();
    } catch (err) {
      console.error('Failed to clear session draft:', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg text-fg">
      {/* Guest Banner */}
      <GuestBanner />

      {/* Main Header */}
      <Header
        onClearClick={() => setIsClearModalOpen(true)}
        wordCount={counts.words}
        charCount={counts.chars}
      />

      {/* Body Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-8 flex flex-col gap-6">
        {/* Real-time Risk meter with live latency and top token highlights */}
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

        {/* Security Evidence & Explanations Panel */}
        {analysisResult?.evidence && analysisResult.evidence.length > 0 && (
          <ExplanationsPanel evidence={analysisResult.evidence} />
        )}

        {/* Email Editor */}
        <Editor />
      </main>

      {/* Minimal Footer */}
      <footer className="w-full border-t border-border py-4 text-center text-xs font-mono text-muted-fg">
        SafeQuill &middot; Zero raw content logging &middot; Ephemeral guest session (24h TTL) &middot; Brevo Security Mailer
      </footer>

      {/* Clear Confirmation Modal */}
      <ClearModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleConfirmClear}
      />

      {/* Phase 5 Modals & Drawers */}
      <AuthModal />
      <SavedSessionsDrawer />
      <EmailReportModal />
      <AccountSettingsModal />
    </div>
  );
}
