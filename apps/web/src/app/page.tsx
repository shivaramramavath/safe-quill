'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { GuestBanner } from '../components/GuestBanner';
import { Editor } from '../components/Editor';
import { RightPanel } from '../components/RightPanel';
import { ClearModal } from '../components/ClearModal';
import { AuthModal } from '../components/AuthModal';
import { SavedSessionsDrawer } from '../components/SavedSessionsDrawer';
import { EmailReportModal } from '../components/EmailReportModal';
import { AccountSettingsModal } from '../components/AccountSettingsModal';
import { ReportFeedbackModal } from '../components/ReportFeedbackModal';
import { AdminDashboardModal } from '../components/AdminDashboardModal';
import { CommandPalette } from '../components/CommandPalette';
import { ShortcutsModal } from '../components/ShortcutsModal';
import { useDraftStore } from '../store/useDraftStore';
import { clearSessionDraft, fetchCurrentUser, fetchSavedSessions } from '../lib/api';

export default function Home() {
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const {
    resetDraft,
    setCurrentUser,
    setSavedSessions,
  } = useDraftStore();

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
      <Header onClearClick={() => setIsClearModalOpen(true)} />

      {/* Two-Column Responsive Layout (Step 7) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Email Editor (~60% desktop width) */}
          <div className="lg:col-span-7 flex flex-col gap-6 w-full">
            <Editor />
          </div>

          {/* Right Column: Tabbed Panel (~40% desktop width) */}
          <div className="lg:col-span-5 flex flex-col gap-6 w-full">
            <RightPanel />
          </div>
        </div>
      </main>

      {/* Minimal Monochrome Footer (Requirement 2) */}
      <footer className="w-full border-t border-border py-4 text-center text-xs font-mono text-muted-fg">
        SafeQuill &middot; Zero raw content logging
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

      {/* Phase 6 Feedback & Admin Modals */}
      <ReportFeedbackModal />
      <AdminDashboardModal />

      {/* Global Quick Action Modals (Step 6) */}
      <CommandPalette />
      <ShortcutsModal />
    </div>
  );
}
