'use client';

import React from 'react';
import { AlertCircle, Lock } from 'lucide-react';

interface GuestBannerProps {
  onSignInClick?: () => void;
}

export function GuestBanner({ onSignInClick }: GuestBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full border-b border-border bg-muted/60 px-4 py-2 text-xs md:text-sm font-medium transition-colors"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-fg" aria-hidden="true" />
          <span>
            <strong className="font-semibold">Guest Session:</strong> Not saved. Sign in to keep this email and analysis history.
          </span>
        </div>
        <button
          type="button"
          onClick={onSignInClick}
          className="inline-flex items-center gap-1.5 rounded border border-border bg-bg px-2.5 py-1 text-xs font-semibold hover:border-fg transition-colors"
          title="Sign in offered when you save"
        >
          <Lock className="h-3 w-3" />
          <span>Sign In / Save</span>
        </button>
      </div>
    </div>
  );
}
