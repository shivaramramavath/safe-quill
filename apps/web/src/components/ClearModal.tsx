'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ClearModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ClearModal({ isOpen, onClose, onConfirm }: ClearModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-draft-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-bg p-5 shadow-xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted border border-border text-fg">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 id="clear-draft-title" className="text-sm font-bold tracking-tight">
              Clear Current Draft?
            </h2>
            <p className="text-xs text-muted-fg">This action will reset your subject and body.</p>
          </div>
        </div>

        <p className="text-xs text-muted-fg leading-relaxed mb-4">
          Your active guest session draft stored in Redis will be emptied. This cannot be undone.
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="rounded bg-fg text-bg px-3 py-1.5 text-xs font-bold hover:opacity-90 transition-opacity"
          >
            Clear Draft
          </button>
        </div>
      </div>
    </div>
  );
}
