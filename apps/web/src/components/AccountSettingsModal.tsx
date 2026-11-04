'use client';

import React, { useState } from 'react';
import { useDraftStore } from '@/store/useDraftStore';
import { deleteAccountData, exportAccountData, logoutUser } from '@/lib/api';

export function AccountSettingsModal() {
  const {
    isAccountModalOpen,
    setIsAccountModalOpen,
    currentUser,
    setCurrentUser,
    setSavedSessions,
  } = useDraftStore();

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAccountModalOpen || !currentUser) return null;

  const handleExportData = async () => {
    setExporting(true);
    setError(null);
    try {
      const data = await exportAccountData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `safequill-account-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to export account data');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      await deleteAccountData();
      setCurrentUser(null);
      setSavedSessions([]);
      setIsAccountModalOpen(false);
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setSavedSessions([]);
    setIsAccountModalOpen(false);
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md border border-[var(--border)] bg-[var(--bg)] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-4">
          <h2 className="text-sm font-semibold tracking-wide text-[var(--fg)]">
            Account & Privacy Settings
          </h2>
          <button
            onClick={() => {
              setIsAccountModalOpen(false);
              setConfirmDelete(false);
            }}
            className="text-xs text-[var(--muted)] hover:text-[var(--fg)] p-1"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div className="border border-[var(--border)] bg-[var(--bg-subtle)] p-3 space-y-1">
            <span className="text-[var(--muted)] text-[11px] block">Signed in as:</span>
            <span className="font-semibold text-[var(--fg)] text-sm">{currentUser.email}</span>
            <span className="text-[10px] text-[var(--muted)] block">
              Member since: {new Date(currentUser.createdAt).toLocaleDateString()}
            </span>
          </div>

          {error && (
            <div className="border border-[var(--accent-high)] bg-[var(--accent-high)]/10 p-3 text-xs text-[var(--accent-high)]">
              {error}
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-4 space-y-3">
            <h3 className="font-semibold text-[var(--fg)]">GDPR & Data Rights</h3>
            <p className="text-[var(--muted)] leading-relaxed">
              SafeQuill respects strict data isolation. We never train public models on your private emails.
            </p>

            <button
              onClick={handleExportData}
              disabled={exporting}
              className="w-full border border-[var(--border)] bg-[var(--bg)] py-2 text-xs font-semibold text-[var(--fg)] hover:border-[var(--fg)] transition-colors"
            >
              {exporting ? 'Generating JSON...' : 'Export My Data (JSON)'}
            </button>
          </div>

          <div className="border-t border-[var(--border)] pt-4 space-y-3">
            <h3 className="font-semibold text-[var(--accent-high)]">Danger Zone</h3>
            {confirmDelete ? (
              <div className="border border-[var(--accent-high)] p-3 space-y-2 bg-[var(--accent-high)]/5">
                <p className="text-[11px] text-[var(--accent-high)] font-semibold">
                  Are you absolutely certain? This will immediately delete your account, session tokens, and all saved email drafts forever.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="flex-1 bg-[var(--accent-high)] text-white py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Yes, Permanently Delete'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--fg)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full border border-[var(--accent-high)] text-[var(--accent-high)] py-2 text-xs font-semibold hover:bg-[var(--accent-high)]/10 transition-colors"
              >
                Permanently Delete Account
              </button>
            )}
          </div>

          <div className="border-t border-[var(--border)] pt-4 flex justify-end">
            <button
              onClick={handleLogout}
              className="text-xs text-[var(--muted)] hover:text-[var(--fg)] underline"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
