'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  RotateCcw,
  ClipboardPaste,
  Sparkles,
  FileText,
  Shield,
  Download,
  Moon,
  Sun,
  X,
  Keyboard,
  Compass,
} from 'lucide-react';
import { useDraftStore } from '../store/useDraftStore';
import { useTheme } from './providers';
import { EMAIL_SAMPLES } from '../lib/samples';

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  icon: React.ReactNode;
  action: () => void;
}

export function CommandPalette() {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    resetDraft,
    setSubject,
    setBody,
    setRawHeaders,
    setActiveRightTab,
    editorMode,
    setEditorMode,
    inlineSuggestionsEnabled,
    setInlineSuggestionsEnabled,
    setIsShortcutsOpen,
  } = useDraftStore();

  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Global keydown listener for Ctrl+K / Cmd+K and ?
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(!isCommandPaletteOpen);
      } else if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setIsShortcutsOpen(true);
      } else if (e.key === 'Escape' && isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setIsCommandPaletteOpen, setIsShortcutsOpen]);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
      setQuery('');
    }
  }, [isCommandPaletteOpen]);

  // Load sample helper
  const handleLoadSample = (sampleId: string) => {
    const found = EMAIL_SAMPLES.find((s) => s.id === sampleId);
    if (found) {
      setSubject(found.subject);
      setBody(found.body);
      setRawHeaders(found.rawHeaders || '');
    }
    setIsCommandPaletteOpen(false);
  };

  const commands: CommandItem[] = [
    // Samples
    ...EMAIL_SAMPLES.map((s) => ({
      id: `sample-${s.id}`,
      title: `Sample: ${s.title}`,
      subtitle: `Load pre-built ${s.category} email test case`,
      category: 'Sample Library',
      icon: <Compass className="h-4 w-4" />,
      action: () => handleLoadSample(s.id),
    })),

    // Editor Actions
    {
      id: 'mode-toggle',
      title: `Switch to ${editorMode === 'inspect' ? 'Compose Mode' : 'Inspect Mode'}`,
      subtitle: `Toggle between threat detection and deliverability checking`,
      category: 'Editor Modes',
      icon: <Shield className="h-4 w-4" />,
      action: () => {
        setEditorMode(editorMode === 'inspect' ? 'compose' : 'inspect');
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: 'tab-generate',
      title: 'Open Draft Generator',
      subtitle: 'Compose tailored emails from quick templates or prompts',
      category: 'AI Assistant',
      icon: <Sparkles className="h-4 w-4" />,
      action: () => {
        setActiveRightTab('generate');
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: 'tab-summary',
      title: 'Summarize Active Email',
      subtitle: 'Extract TL;DR, 3 bullets, action items, or safe summary',
      category: 'AI Assistant',
      icon: <FileText className="h-4 w-4" />,
      action: () => {
        setActiveRightTab('summary');
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: 'tab-verdict',
      title: 'View Risk Verdict',
      subtitle: 'Inspect ML score, tone meter, clarity score, and intent',
      category: 'Navigation',
      icon: <Shield className="h-4 w-4" />,
      action: () => {
        setActiveRightTab('verdict');
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: 'tab-details',
      title: 'View Security Evidence Details',
      subtitle: 'Inspect detailed detector breakdown and technical evidence',
      category: 'Navigation',
      icon: <Shield className="h-4 w-4" />,
      action: () => {
        setActiveRightTab('details');
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: 'toggle-ghost-text',
      title: `Inline Suggestions: ${inlineSuggestionsEnabled ? 'Disable' : 'Enable'}`,
      subtitle: 'Toggle ghost text autocomplete while typing',
      category: 'Settings',
      icon: <Keyboard className="h-4 w-4" />,
      action: () => {
        setInlineSuggestionsEnabled(!inlineSuggestionsEnabled);
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: 'shortcuts-modal',
      title: 'View Keyboard Shortcuts',
      subtitle: 'Inspect all navigation and editing hotkeys (?)',
      category: 'Help',
      icon: <Keyboard className="h-4 w-4" />,
      action: () => {
        setIsCommandPaletteOpen(false);
        setIsShortcutsOpen(true);
      },
    },
    {
      id: 'toggle-theme',
      title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
      subtitle: 'Toggle strict WCAG AA high contrast theme',
      category: 'Appearance',
      icon: theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
      action: () => {
        toggleTheme();
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: 'reset-draft',
      title: 'Clear Draft',
      subtitle: 'Reset email subject, body, and raw headers',
      category: 'Draft',
      icon: <RotateCcw className="h-4 w-4" />,
      action: () => {
        resetDraft();
        setIsCommandPaletteOpen(false);
      },
    },
  ];

  const filtered = query.trim()
    ? commands.filter(
        (c) =>
          c.title.toLowerCase().includes(query.toLowerCase()) ||
          c.subtitle.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase()),
      )
    : commands;

  const handleSelect = (idx: number) => {
    if (filtered[idx]) {
      filtered[idx].action();
    }
  };

  const handleKeyDownList = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(selectedIndex);
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={() => setIsCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-xl border border-border bg-bg shadow-2xl rounded-lg overflow-hidden flex flex-col font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/10">
          <Search className="h-4 w-4 text-muted-fg" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDownList}
            placeholder="Type a command or search action (e.g. sample, generate, mode)..."
            className="w-full bg-transparent text-sm focus:outline-none placeholder:text-muted-fg/60 font-medium"
          />
          <kbd className="hidden sm:inline font-mono text-[10px] border border-border px-1.5 py-0.5 rounded text-muted-fg">
            ESC
          </kbd>
        </div>

        {/* Action list */}
        <div className="max-h-80 overflow-y-auto p-2 flex flex-col gap-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-muted-fg">
              No actions matching &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => handleSelect(i)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full text-left p-2.5 rounded flex items-center justify-between text-xs transition-colors ${
                  selectedIndex === i
                    ? 'bg-fg text-bg font-semibold'
                    : 'text-fg hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className={selectedIndex === i ? 'text-bg' : 'text-muted-fg'}>
                    {cmd.icon}
                  </span>
                  <div className="truncate">
                    <span className="block truncate font-semibold">{cmd.title}</span>
                    <span
                      className={`block text-[11px] truncate ${
                        selectedIndex === i ? 'text-bg/80' : 'text-muted-fg'
                      }`}
                    >
                      {cmd.subtitle}
                    </span>
                  </div>
                </div>
                <span
                  className={`font-mono text-[10px] uppercase ml-2 shrink-0 px-1.5 py-0.5 border rounded ${
                    selectedIndex === i
                      ? 'border-bg/40 text-bg'
                      : 'border-border text-muted-fg'
                  }`}
                >
                  {cmd.category}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="border-t border-border px-4 py-2 bg-muted/10 flex items-center justify-between text-[11px] font-mono text-muted-fg">
          <span>
            Use <kbd className="border border-border px-1 rounded">&uarr;</kbd>{' '}
            <kbd className="border border-border px-1 rounded">&darr;</kbd> to navigate,{' '}
            <kbd className="border border-border px-1 rounded">Enter</kbd> to execute
          </span>
          <span>SafeQuill CLI</span>
        </div>
      </div>
    </div>
  );
}
