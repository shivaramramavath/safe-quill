'use client';

import React, { useEffect, useState } from 'react';
import { useDraftStore } from '@/store/useDraftStore';
import {
  deleteSavedSession,
  fetchSavedSessions,
  renameSavedSession,
} from '@/lib/api';
import { SavedSession } from '@safe-quill/shared';

export function SavedSessionsDrawer() {
  const {
    isSavedDrawerOpen,
    setIsSavedDrawerOpen,
    savedSessions,
    setSavedSessions,
    loadSavedSession,
  } = useDraftStore();

  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const refreshSessions = async () => {
    setLoading(true);
    try {
      const list = await fetchSavedSessions();
      setSavedSessions(list);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSavedDrawerOpen) {
      refreshSessions();
    }
  }, [isSavedDrawerOpen]);

  if (!isSavedDrawerOpen) return null;

  const handleStartRename = (s: SavedSession) => {
    setEditingId(s.id);
    setEditTitle(s.title);
  };

  const handleSaveRename = async (id: string) => {
    if (!editTitle.trim()) return;
    try {
      const updated = await renameSavedSession(id, editTitle.trim());
      setSavedSessions(
        savedSessions.map((s) => (s.id === id ? { ...s, title: updated.title } : s)),
      );
      setEditingId(null);
    } catch {
      // Ignore error
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this saved email draft?')) return;
    try {
      await deleteSavedSession(id);
      setSavedSessions(savedSessions.filter((s) => s.id !== id));
    } catch {
      // Ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md h-full border-l border-[var(--border)] bg-[var(--bg)] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-[var(--fg)]">
              Saved Email Drafts
            </h2>
            <span className="border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--muted)]">
              {savedSessions.length}
            </span>
          </div>
          <button
            onClick={() => setIsSavedDrawerOpen(false)}
            className="text-xs text-[var(--muted)] hover:text-[var(--fg)] p-1"
            aria-label="Close drawer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && savedSessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--muted)]">
              Loading saved sessions...
            </div>
          ) : savedSessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--muted)] space-y-2">
              <p>No saved email drafts yet.</p>
              <p className="text-[11px]">Click &ldquo;Save Draft&rdquo; in the top bar to keep your current draft.</p>
            </div>
          ) : (
            savedSessions.map((s) => (
              <div
                key={s.id}
                className="border border-[var(--border)] bg-[var(--bg-subtle)] p-3 hover:border-[var(--fg)] transition-colors space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  {editingId === s.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--fg)]"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveRename(s.id)}
                        className="border border-[var(--border)] bg-[var(--fg)] text-[var(--bg)] px-2 py-1 text-[11px] font-semibold"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-[11px] text-[var(--muted)] px-1"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <h3 className="text-xs font-semibold text-[var(--fg)] line-clamp-1">
                      {s.title}
                    </h3>
                  )}

                  {s.analysisSnapshot && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 border ${
                        s.analysisSnapshot.verdict === 'HIGH'
                          ? 'border-[var(--accent-high)] text-[var(--accent-high)]'
                          : s.analysisSnapshot.verdict === 'MEDIUM'
                          ? 'border-[var(--border)] text-[var(--fg)]'
                          : 'border-[var(--border)] text-[var(--muted)]'
                      }`}
                    >
                      {s.analysisSnapshot.score}/100
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-[var(--muted)] line-clamp-2">
                  {s.body || s.subject || '(Empty body)'}
                </p>

                <div className="flex items-center justify-between text-[10px] text-[var(--muted)] pt-1 border-t border-[var(--border)]/50">
                  <span>
                    {new Date(s.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartRename(s)}
                      className="hover:text-[var(--fg)] underline"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="hover:text-[var(--accent-high)] underline"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => {
                        loadSavedSession(s);
                        setIsSavedDrawerOpen(false);
                      }}
                      className="border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--fg)] hover:border-[var(--fg)]"
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
