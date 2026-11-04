'use client';

import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { useDraftStore } from '../store/useDraftStore';

export function ShortcutsModal() {
  const { isShortcutsOpen, setIsShortcutsOpen } = useDraftStore();

  if (!isShortcutsOpen) return null;

  const shortcuts = [
    { key: 'Tab', desc: 'Accept entire inline ghost text suggestion' },
    { key: 'Ctrl + →', desc: 'Accept one word of ghost text suggestion' },
    { key: 'Esc', desc: 'Dismiss active ghost text suggestion / close dialogs' },
    { key: 'Ctrl + K / ⌘K', desc: 'Open Command Palette' },
    { key: 'Ctrl + Z / ⌘Z', desc: 'Undo last typing or editing change' },
    { key: 'Ctrl + Y / ⌘⇧Z', desc: 'Redo previously undone change' },
    { key: 'Ctrl + V / ⌘V', desc: 'Paste (smart-splits RFC headers if detected)' },
    { key: '?', desc: 'Open this keyboard shortcuts reference' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={() => setIsShortcutsOpen(false)}
    >
      <div
        className="w-full max-w-md border border-border bg-bg shadow-2xl rounded-lg overflow-hidden flex flex-col font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/10">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            <h3 className="text-sm font-bold">Keyboard Shortcuts</h3>
          </div>
          <button
            type="button"
            onClick={() => setIsShortcutsOpen(false)}
            className="text-muted-fg hover:text-fg p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-2.5">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-fg font-sans">{s.desc}</span>
              <kbd className="border border-border px-2 py-0.5 rounded bg-muted/30 font-bold ml-3 shrink-0">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="border-t border-border px-4 py-2 bg-muted/10 text-right">
          <button
            type="button"
            onClick={() => setIsShortcutsOpen(false)}
            className="border border-border px-3 py-1 text-xs font-semibold rounded hover:border-fg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
