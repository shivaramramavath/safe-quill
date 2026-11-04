'use client';

import React, { useState } from 'react';
import { useDraftStore } from '@/store/useDraftStore';
import { submitPredictionFeedback } from '@/lib/api';

export function ReportFeedbackModal() {
  const {
    isReportFeedbackModalOpen,
    setIsReportFeedbackModalOpen,
    analysisResult,
  } = useDraftStore();

  const [reportedLabel, setReportedLabel] = useState<'ham' | 'spam'>('ham');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isReportFeedbackModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await submitPredictionFeedback({
        reportedLabel,
        reason: reason.trim(),
        originalScore: analysisResult?.score || 0,
        originalLevel: analysisResult?.level || 'LOW',
      });

      setSuccess(true);
      setTimeout(() => {
        setIsReportFeedbackModalOpen(false);
        setSuccess(false);
        setReason('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md border border-[var(--border)] bg-[var(--bg)] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-4">
          <h2 className="text-sm font-semibold tracking-wide text-[var(--fg)]">
            Report Incorrect Prediction
          </h2>
          <button
            onClick={() => setIsReportFeedbackModalOpen(false)}
            className="text-xs text-[var(--muted)] hover:text-[var(--fg)] p-1"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-[var(--muted)] mb-4 leading-relaxed">
          Help our security team improve SafeQuill. Submissions are queued for offline analyst review.
          <strong className="block mt-1 text-[var(--fg)]">
            Product Policy: Private emails are never logged, and models are never automatically retrained on user input.
          </strong>
        </p>

        {analysisResult && (
          <div className="border border-[var(--border)] bg-[var(--bg-subtle)] p-3 mb-4 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Current Verdict:</span>
              <span className="font-mono font-bold text-[var(--fg)]">
                {analysisResult.level} ({analysisResult.score}/100)
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
            ✓ Report queued for human analyst review. Thank you for helping keep SafeQuill accurate!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--fg)] mb-2">
                What should this email&apos;s classification be?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReportedLabel('ham')}
                  className={`border py-2 text-xs font-semibold transition-colors ${
                    reportedLabel === 'ham'
                      ? 'border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]'
                      : 'border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] hover:border-[var(--fg)]'
                  }`}
                >
                  Legitimate (Ham)
                </button>
                <button
                  type="button"
                  onClick={() => setReportedLabel('spam')}
                  className={`border py-2 text-xs font-semibold transition-colors ${
                    reportedLabel === 'spam'
                      ? 'border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]'
                      : 'border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] hover:border-[var(--fg)]'
                  }`}
                >
                  Spam / Phishing
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--fg)] mb-1">
                Context / Reason (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. This was an authentic payroll notification from internal HR."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-[var(--border)] bg-[var(--bg)] p-2.5 text-xs text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--fg)] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setIsReportFeedbackModalOpen(false)}
                className="border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="border border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)] px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
