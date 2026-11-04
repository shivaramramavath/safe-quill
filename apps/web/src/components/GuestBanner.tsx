'use client';

import React from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import { useDraftStore } from '@/store/useDraftStore';

export function GuestBanner() {
  const { currentUser, setIsAuthModalOpen } = useDraftStore();

  if (currentUser) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full border-b border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 text-xs md:text-sm font-medium transition-colors"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-[var(--fg)]" aria-hidden="true" />
          <span>
            <strong className="font-semibold">Guest Session:</strong> Not saved. Sign in to keep this email and analysis history.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsAuthModalOpen(true)}
          className="inline-flex items-center gap-1.5 border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-xs font-semibold hover:border-[var(--fg)] transition-colors"
          title="Sign in offered when you save"
        >
          <Lock className="h-3 w-3" />
          <span>Sign In / Save</span>
        </button>
      </div>
    </div>
  );
}
