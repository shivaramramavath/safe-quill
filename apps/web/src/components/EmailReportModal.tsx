'use client';

import React, { useState } from 'react';
import { useDraftStore } from '@/store/useDraftStore';
import { sendReportEmail } from '@/lib/api';

export function EmailReportModal() {
  const {
    isReportModalOpen,
    setIsReportModalOpen,
    currentUser,
    subject,
    body,
    analysisResult,
  } = useDraftStore();

  const [recipient, setRecipient] = useState(currentUser?.email || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isReportModalOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !recipient.includes('@')) {
      setError('Please provide a valid email address');
      return;
    }

    setLoading(true);
    setError(null);

    const cues = analysisResult?.evidence?.map((e) => `${e.detectorName}: ${e.reason}`) || [];

    try {
      await sendReportEmail({
        recipientEmail: recipient.trim(),
        subject: subject || 'SafeQuill Email Security Audit',
        body: body || '',
        score: analysisResult?.score || 0,
        verdict: analysisResult?.level || 'LOW',
        cues,
      });

      setSuccess(true);
      setTimeout(() => {
        setIsReportModalOpen(false);
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md border border-[var(--border)] bg-[var(--bg)] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-4">
          <h2 className="text-sm font-semibold tracking-wide text-[var(--fg)]">
            Email Security Audit Report
          </h2>
          <button
            onClick={() => setIsReportModalOpen(false)}
            className="text-xs text-[var(--muted)] hover:text-[var(--fg)] p-1"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-[var(--muted)] mb-4">
          Dispatch an official HTML audit summary of this email draft's risk verdict, score, and flagged indicators powered by Brevo.
        </p>

        {analysisResult && (
          <div className="border border-[var(--border)] bg-[var(--bg-subtle)] p-3 mb-4 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Calculated Risk Score:</span>
              <span className="font-mono font-bold text-[var(--fg)]">
                {analysisResult.score}/100 ({analysisResult.level})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Evidence Flagged:</span>
              <span className="font-mono text-[var(--fg)]">
                {analysisResult.evidence?.length || 0} indicators
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 border border-[var(--accent-high)] bg-[var(--accent-high)]/10 p-3 text-xs text-[var(--accent-high)]">
            {error}
          </div>
        )}

        {success ? (
          <div className="border border-[var(--border)] bg-[var(--bg-subtle)] p-4 text-center text-xs font-semibold text-[var(--fg)]">
            ✓ Report dispatched successfully via Brevo!
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--fg)] mb-1">
                Recipient Email Address
              </label>
              <input
                type="email"
                placeholder="recipient@example.com"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
                className="w-full border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--fg)]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="border border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)] px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Dispatching...' : 'Send Audit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
