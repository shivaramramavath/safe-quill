'use client';

import React from 'react';
import { Moon, Sun, Shield, RotateCcw } from 'lucide-react';
import { useTheme } from './providers';

interface HeaderProps {
  onClearClick: () => void;
  wordCount: number;
  charCount: number;
}

export function Header({ onClearClick, wordCount, charCount }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="w-full border-b border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/60 sticky top-0 z-40">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded border border-border bg-fg text-bg">
            <Shield className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-base sm:text-lg">SafeQuill</span>
              <span className="rounded border border-border px-1.5 py-0.2 text-[10px] uppercase font-mono tracking-wider text-muted-fg">
                v0.1
              </span>
            </div>
            <p className="hidden text-[11px] text-muted-fg sm:block -mt-1">
              Phishing Detector & Email Security
            </p>
          </div>
        </div>

        {/* Center stats */}
        <div className="hidden md:flex items-center gap-3 text-xs font-mono text-muted-fg border border-border rounded px-3 py-1 bg-muted/40">
          <span>{wordCount} words</span>
          <span className="text-border">|</span>
          <span>{charCount} chars</span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClearClick}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-bg px-2.5 py-1.5 text-xs font-medium hover:border-fg transition-colors"
            title="Reset email draft"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded border border-border bg-bg hover:border-fg transition-colors"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4 text-fg" />
            ) : (
              <Sun className="h-4 w-4 text-fg" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
