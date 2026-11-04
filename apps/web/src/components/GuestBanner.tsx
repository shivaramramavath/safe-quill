'use client';

import React, { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useDraftStore } from '@/store/useDraftStore';

export function GuestBanner() {
  const { currentUser } = useDraftStore();
  const [isDismissed, setIsDismissed] = useState(false);

  if (currentUser || isDismissed) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full border-b border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-1.5 text-xs font-mono transition-colors"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-muted-fg" aria-hidden="true" />
          <span className="text-muted-fg">
            Guest session: not saved
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="text-muted-fg hover:text-fg p-0.5 transition-colors"
          title="Dismiss notice"
          aria-label="Dismiss guest session notice"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
