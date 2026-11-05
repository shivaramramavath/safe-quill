'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  EditorView,
  WidgetType,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
  keymap,
  placeholder as cmPlaceholder,
} from '@codemirror/view';
import {
  EditorState,
  StateField,
  StateEffect,
  Compartment,
} from '@codemirror/state';
import {
  history,
  defaultKeymap,
  historyKeymap,
} from '@codemirror/commands';
import { requestSuggestNextWord, recordGhostMetric } from '../lib/api';

// Effects for Ghost Text updates
interface GhostData {
  text: string;
  tier: 'local' | 'groq';
  pos: number;
}

export const setGhostEffect = StateEffect.define<GhostData | null>();

// Ghost Text Widget
class GhostWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly showTabBadge: boolean,
    readonly isGroqTier: boolean,
  ) {
    super();
  }

  toDOM() {
    const wrap = document.createElement('span');
    wrap.className =
      'cm-ghost-text select-none pointer-events-none font-mono text-sm leading-relaxed';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.dataset.testid = 'ghost-suggestion';
    // Clear, readable ghost text styling (distinct from full opacity document text)
    wrap.style.color = 'var(--muted-fg, #9ca3af)';
    wrap.style.opacity = '0.72';
    wrap.style.display = 'inline';

    // The ghost text string
    const textNode = document.createTextNode(this.text);
    wrap.appendChild(textNode);

    // Tab hint badge shown for first 3 accepts, then hidden
    if (this.showTabBadge) {
      const badge = document.createElement('span');
      badge.className =
        'cm-ghost-badge ml-1.5 inline-flex items-center px-1.5 py-0.2 rounded border border-border bg-muted/30 text-[10px] font-mono font-medium text-fg shadow-xs';
      badge.textContent = 'Tab ⇥';
      badge.style.opacity = '0.9';
      wrap.appendChild(badge);
    }

    return wrap;
  }

  ignoreEvent() {
    return true;
  }
}

// StateField managing ghost text decoration
const ghostField = StateField.define<GhostData | null>({
  create() {
    return null;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setGhostEffect)) {
        return effect.value;
      }
    }
    // If the document changed and wasn't a match-ahead effect handled outside, clear or adjust
    if (tr.docChanged && value) {
      return null;
    }
    return value;
  },
  provide: (field) =>
    EditorView.decorations.from(field, (data) => {
      if (!data || !data.text) return Decoration.none;

      // Check hint badge count in localStorage
      let showBadge = false;
      if (typeof window !== 'undefined') {
        const count = parseInt(localStorage.getItem('safequill_tab_hint_count') || '0', 10);
        showBadge = count < 3;
      }

      const widget = Decoration.widget({
        widget: new GhostWidget(data.text, showBadge, data.tier === 'groq'),
        side: 1,
      });

      try {
        return Decoration.set([widget.range(data.pos)]);
      } catch {
        return Decoration.none;
      }
    }),
});

interface CodeMirrorEditorProps {
  value: string;
  onChange: (val: string) => void;
  onPaste?: (rawText: string) => void;
  placeholder?: string;
  analysisLevel?: string;
  inlineSuggestionsEnabled?: boolean;
  aiSuggestionsEnabled?: boolean;
  onAiUsedChange?: (aiUsed: boolean) => void;
  onGhostActiveChange?: (active: boolean) => void;
}

export function CodeMirrorEditor({
  value,
  onChange,
  onPaste,
  placeholder = 'Type email content here...',
  analysisLevel,
  inlineSuggestionsEnabled = true,
  aiSuggestionsEnabled = true,
  onAiUsedChange,
  onGhostActiveChange,
}: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isPastingRef = useRef(false);
  const isComposingRef = useRef(false);

  // Ghost text coordination
  const fastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const groqTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentGhostRef = useRef<GhostData | null>(null);

  // Screen reader polite live region
  const [liveMessage, setLiveMessage] = useState('');

  // Internal state tracking
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onPasteRef = useRef(onPaste);
  onPasteRef.current = onPaste;

  const analysisLevelRef = useRef(analysisLevel);
  analysisLevelRef.current = analysisLevel;

  const inlineSuggestionsRef = useRef(inlineSuggestionsEnabled);
  inlineSuggestionsRef.current = inlineSuggestionsEnabled;

  const aiSuggestionsRef = useRef(aiSuggestionsEnabled);
  aiSuggestionsRef.current = aiSuggestionsEnabled;

  // Clear pending timers and requests
  const cancelGhostRequests = () => {
    if (fastTimerRef.current) {
      clearTimeout(fastTimerRef.current);
      fastTimerRef.current = null;
    }
    if (groqTimerRef.current) {
      clearTimeout(groqTimerRef.current);
      groqTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const clearGhost = (view: EditorView) => {
    cancelGhostRequests();
    if (currentGhostRef.current) {
      currentGhostRef.current = null;
      view.dispatch({
        effects: setGhostEffect.of(null),
      });
      onGhostActiveChange?.(false);
      onAiUsedChange?.(false);
      setLiveMessage('');
    }
  };

  const scheduleGhostSuggestion = (view: EditorView) => {
    cancelGhostRequests();

    if (!inlineSuggestionsRef.current) return;
    if (analysisLevelRef.current === 'HIGH') return;
    if (isPastingRef.current || isComposingRef.current) return;

    const state = view.state;
    const sel = state.selection.main;
    if (!sel.empty) return;

    const pos = sel.head;
    const line = state.doc.lineAt(pos);

    // Trigger condition: caret at end of line/paragraph, at least 3 chars typed
    if (pos !== line.to) return;
    if (state.doc.length < 3) return;

    const context = state.sliceDoc(Math.max(0, pos - 600), pos);
    if (!context.trim()) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Tier (a): Fast local next-word after 200 ms
    fastTimerRef.current = setTimeout(async () => {
      try {
        const start = performance.now();
        const res = await requestSuggestNextWord(context, false, controller.signal);
        const latency = Math.round(performance.now() - start);

        if (res.suggestions && res.suggestions.length > 0 && res.suggestions[0].completion) {
          const comp = res.suggestions[0].completion;
          // Security checks: never suggest URLs or links
          if (!comp.includes('http://') && !comp.includes('https://') && !comp.includes('www.')) {
            // Check view still matches pos
            if (viewRef.current && viewRef.current.state.selection.main.head === pos) {
              const ghost: GhostData = {
                text: comp,
                tier: res.tier || 'local',
                pos,
              };
              currentGhostRef.current = ghost;
              viewRef.current.dispatch({
                effects: setGhostEffect.of(ghost),
              });
              onGhostActiveChange?.(true);
              onAiUsedChange?.(res.tier === 'groq');
              setLiveMessage('Suggestion available, press Tab to accept');
              recordGhostMetric({ shown: 1, tier: res.tier, latencyMs: latency });
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          // Silent fallback
        }
      }
    }, 200);

    // Tier (b): Groq LLM completion after 600 ms idle
    if (aiSuggestionsRef.current) {
      groqTimerRef.current = setTimeout(async () => {
        try {
          const start = performance.now();
          const res = await requestSuggestNextWord(context, true, controller.signal);
          const latency = Math.round(performance.now() - start);

          if (
            res.tier === 'groq' &&
            res.suggestions &&
            res.suggestions.length > 0 &&
            res.suggestions[0].completion
          ) {
            const comp = res.suggestions[0].completion;
            if (!comp.includes('http://') && !comp.includes('https://') && !comp.includes('www.')) {
              if (viewRef.current && viewRef.current.state.selection.main.head === pos) {
                const ghost: GhostData = {
                  text: comp,
                  tier: 'groq',
                  pos,
                };
                currentGhostRef.current = ghost;
                viewRef.current.dispatch({
                  effects: setGhostEffect.of(ghost),
                });
                onGhostActiveChange?.(true);
                onAiUsedChange?.(true);
                setLiveMessage('Suggestion available, press Tab to accept');
                recordGhostMetric({ shown: 1, tier: 'groq', latencyMs: latency });
              }
            }
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            // Silent fallback
          }
        }
      }, 600);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Theme matching SafeQuill dark/light styles
    const editorTheme = EditorView.theme({
      '&': {
        height: '100%',
        minHeight: '240px',
        backgroundColor: 'transparent',
        color: 'var(--fg)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: '0.875rem',
        lineHeight: '1.625',
      },
      '.cm-content': {
        padding: '0.75rem 1rem',
        caretColor: 'var(--fg)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'inherit',
      },
      '.cm-cursor': {
        borderLeftColor: 'var(--fg)',
        borderLeftWidth: '2px',
      },
      '.cm-placeholder': {
        color: 'var(--muted)',
        opacity: '0.6',
      },
      '.cm-ghost-text': {
        color: 'var(--muted-fg, #9ca3af) !important',
        opacity: '0.72 !important',
        userSelect: 'none',
        pointerEvents: 'none',
      },
      '.cm-ghost-text .cm-ghost-badge': {
        opacity: '0.9 !important',
      },
      '.cm-line': {
        padding: '0',
      },
    });

    // Custom Keymaps for Tab, Ctrl/Cmd+Right, Esc
    const ghostKeymapExtension = keymap.of([
      {
        key: 'Tab',
        run: (view) => {
          const ghost = currentGhostRef.current;
          if (ghost && ghost.text) {
            const pos = ghost.pos;
            // Insert full suggestion as 1 undo step
            view.dispatch({
              changes: { from: pos, insert: ghost.text },
              selection: { anchor: pos + ghost.text.length },
              userEvent: 'input.complete',
            });

            // Increment badge counter
            if (typeof window !== 'undefined') {
              const count = parseInt(localStorage.getItem('safequill_tab_hint_count') || '0', 10);
              localStorage.setItem('safequill_tab_hint_count', String(count + 1));
            }

            recordGhostMetric({ accepted: 1, tier: ghost.tier });
            clearGhost(view);
            return true; // Handled, do not trap Tab
          }
          return false; // Not handled: allow normal Tab behavior
        },
      },
      {
        key: 'Mod-ArrowRight',
        run: (view) => {
          const ghost = currentGhostRef.current;
          if (ghost && ghost.text) {
            const match = ghost.text.match(/^(\s*\S+\s*)/);
            if (match) {
              const word = match[1];
              const remaining = ghost.text.slice(word.length);
              const pos = ghost.pos;

              view.dispatch({
                changes: { from: pos, insert: word },
                selection: { anchor: pos + word.length },
                userEvent: 'input.complete.word',
              });

              if (remaining) {
                const newGhost: GhostData = {
                  text: remaining,
                  tier: ghost.tier,
                  pos: pos + word.length,
                };
                currentGhostRef.current = newGhost;
                view.dispatch({
                  effects: setGhostEffect.of(newGhost),
                });
              } else {
                clearGhost(view);
              }
              return true;
            }
          }
          return false;
        },
      },
      {
        key: 'Escape',
        run: (view) => {
          const ghost = currentGhostRef.current;
          if (ghost) {
            recordGhostMetric({ dismissed: 1, tier: ghost.tier });
            clearGhost(view);
            return true;
          }
          return false;
        },
      },
    ]);

    // ViewUpdate listener for typed changes and match-ahead logic
    const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged) {
        const newText = update.state.doc.toString();
        onChangeRef.current(newText);

        // Check Match-ahead: if user typed the exact next char of ghost text
        const ghost = currentGhostRef.current;
        let matchedAhead = false;

        if (ghost && ghost.text && update.transactions.length > 0) {
          const tr = update.transactions[0];
          let insertedText = '';
          tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
            insertedText += inserted.toString();
          });

          if (insertedText && ghost.text.startsWith(insertedText)) {
            matchedAhead = true;
            const remaining = ghost.text.slice(insertedText.length);
            const newPos = ghost.pos + insertedText.length;

            if (remaining) {
              const newGhost: GhostData = {
                text: remaining,
                tier: ghost.tier,
                pos: newPos,
              };
              currentGhostRef.current = newGhost;
              // Schedule update without clearing
              setTimeout(() => {
                if (viewRef.current) {
                  viewRef.current.dispatch({
                    effects: setGhostEffect.of(newGhost),
                  });
                }
              }, 0);
            } else {
              clearGhost(update.view);
            }
          }
        }

        if (!matchedAhead) {
          clearGhost(update.view);
          scheduleGhostSuggestion(update.view);
        }
      } else if (update.selectionSet) {
        // Caret moved without text change
        const ghost = currentGhostRef.current;
        if (ghost && update.state.selection.main.head !== ghost.pos) {
          clearGhost(update.view);
          scheduleGhostSuggestion(update.view);
        }
      }
    });

    // DOM event handlers: paste, composition, focus
    const domHandlers = EditorView.domEventHandlers({
      paste(event, view) {
        isPastingRef.current = true;
        clearGhost(view);
        setTimeout(() => {
          isPastingRef.current = false;
        }, 100);

        if (onPasteRef.current) {
          event.preventDefault();
          const rawText = event.clipboardData?.getData('text/plain') || '';
          onPasteRef.current(rawText);
          return true;
        }
        return false;
      },
      compositionstart() {
        isComposingRef.current = true;
      },
      compositionend(event, view) {
        isComposingRef.current = false;
        scheduleGhostSuggestion(view);
      },
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        ghostKeymapExtension,
        ghostField,
        EditorView.lineWrapping,
        cmPlaceholder(placeholder),
        editorTheme,
        updateListener,
        domHandlers,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      cancelGhostRequests();
      view.destroy();
    };
  }, []);

  // Sync external value changes to CodeMirror
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (value !== currentDoc) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
      clearGhost(view);
    }
  }, [value]);

  // Cancel ghost if high risk or suggestions disabled
  useEffect(() => {
    if (analysisLevel === 'HIGH' || !inlineSuggestionsEnabled) {
      if (viewRef.current) {
        clearGhost(viewRef.current);
      }
    }
  }, [analysisLevel, inlineSuggestionsEnabled]);

  return (
    <div className="relative w-full">
      {/* Polite live region for accessibility screen readers */}
      <div role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      <div
        ref={containerRef}
        data-testid="codemirror-editor"
        className="relative z-10 w-full min-h-[240px] focus-within:ring-0"
      />
    </div>
  );
}
