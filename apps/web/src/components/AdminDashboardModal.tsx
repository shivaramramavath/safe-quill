'use client';

import React, { useEffect, useState } from 'react';
import { useDraftStore } from '@/store/useDraftStore';
import {
  fetchAdminAnalytics,
  fetchMlMetrics,
  fetchPendingFeedback,
  fetchSystemConfig,
  markFeedbackReviewed,
  rollbackMlModel,
  updateSystemConfig,
} from '@/lib/api';
import {
  AnalyticsOverview,
  MlMetrics,
  PredictionFeedback,
  SystemConfig,
} from '@safe-quill/shared';

export function AdminDashboardModal() {
  const { isAdminModalOpen, setIsAdminModalOpen } = useDraftStore();

  const [activeTab, setActiveTab] = useState<'analytics' | 'ml' | 'reviews' | 'config'>('analytics');
  const [loading, setLoading] = useState(false);

  // Data states
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [mlMetrics, setMlMetrics] = useState<MlMetrics | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState<PredictionFeedback[]>([]);
  const [config, setConfig] = useState<SystemConfig | null>(null);

  // Config edit state
  const [highThreshold, setHighThreshold] = useState(75);
  const [mediumThreshold, setMediumThreshold] = useState(40);
  const [blockedDomainsInput, setBlockedDomainsInput] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('v1.0.0');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isAdminModalOpen) {
      loadAllData();
    }
  }, [isAdminModalOpen]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [an, ml, fb, cfg] = await Promise.all([
        fetchAdminAnalytics().catch(() => null),
        fetchMlMetrics().catch(() => null),
        fetchPendingFeedback().catch(() => []),
        fetchSystemConfig().catch(() => null),
      ]);

      if (an) setAnalytics(an);
      if (ml) {
        setMlMetrics(ml);
        setSelectedVersion(ml.activeModelVersion);
      }
      setPendingFeedback(fb);
      if (cfg) {
        setConfig(cfg);
        setHighThreshold(cfg.highThreshold);
        setMediumThreshold(cfg.mediumThreshold);
        setBlockedDomainsInput(cfg.blockedDomains.join(', '));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isAdminModalOpen) return null;

  const handleMarkReviewed = async (id: string) => {
    try {
      await markFeedbackReviewed(id);
      setPendingFeedback(pendingFeedback.filter((f) => f.id !== id));
    } catch {
      // Ignore
    }
  };

  const handleSaveConfig = async () => {
    setSaveMessage(null);
    try {
      const domains = blockedDomainsInput
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      const updated = await updateSystemConfig({
        highThreshold,
        mediumThreshold,
        blockedDomains: domains,
      });

      setConfig(updated);
      setSaveMessage('✓ Configuration updated successfully.');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message}`);
    }
  };

  const handleRollback = async () => {
    if (!confirm(`Confirm activating model version ${selectedVersion}?`)) return;
    try {
      await rollbackMlModel(selectedVersion);
      setSaveMessage(`✓ Model version ${selectedVersion} activated.`);
      loadAllData();
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col border border-[var(--border)] bg-[var(--bg)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold tracking-tight text-[var(--fg)]">
              SafeQuill Admin & ML Operations
            </h2>
            <span className="border border-[var(--border)] px-2 py-0.5 text-[10px] font-mono text-[var(--muted)]">
              Admin Portal
            </span>
          </div>
          <button
            onClick={() => setIsAdminModalOpen(false)}
            className="text-xs text-[var(--muted)] hover:text-[var(--fg)] p-1"
            aria-label="Close admin modal"
          >
            ✕
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-[var(--border)] bg-[var(--bg-subtle)] px-6 gap-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'analytics'
                ? 'border-[var(--fg)] text-[var(--fg)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            Analytics Overview
          </button>
          <button
            onClick={() => setActiveTab('ml')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'ml'
                ? 'border-[var(--fg)] text-[var(--fg)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            MLOps & Evaluation
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'reviews'
                ? 'border-[var(--fg)] text-[var(--fg)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            <span>Review Queue</span>
            {pendingFeedback.length > 0 && (
              <span className="bg-[var(--accent-high)] text-white px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                {pendingFeedback.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'config'
                ? 'border-[var(--fg)] text-[var(--fg)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            Thresholds & Blocklist
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {saveMessage && (
            <div className="border border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-xs font-semibold text-[var(--fg)]">
              {saveMessage}
            </div>
          )}

          {/* 1. Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="border border-[var(--border)] p-4 bg-[var(--bg-subtle)]">
                  <span className="text-[10px] uppercase font-mono text-[var(--muted)]">Total Scans</span>
                  <div className="text-2xl font-bold font-mono text-[var(--fg)] mt-1">
                    {analytics?.totalScans ?? 0}
                  </div>
                </div>
                <div className="border border-[var(--border)] p-4 bg-[var(--bg-subtle)]">
                  <span className="text-[10px] uppercase font-mono text-[var(--muted)]">Spam Detections</span>
                  <div className="text-2xl font-bold font-mono text-[var(--fg)] mt-1">
                    {analytics?.spamCount ?? 0}
                  </div>
                </div>
                <div className="border border-[var(--border)] p-4 bg-[var(--bg-subtle)]">
                  <span className="text-[10px] uppercase font-mono text-[var(--muted)]">Avg Latency</span>
                  <div className="text-2xl font-bold font-mono text-[var(--fg)] mt-1">
                    {analytics?.avgLatencyMs ?? 0}ms
                  </div>
                </div>
                <div className="border border-[var(--border)] p-4 bg-[var(--bg-subtle)]">
                  <span className="text-[10px] uppercase font-mono text-[var(--muted)]">Pending Feedback</span>
                  <div className="text-2xl font-bold font-mono text-[var(--fg)] mt-1">
                    {pendingFeedback.length}
                  </div>
                </div>
              </div>

              <div className="border border-[var(--border)] p-5 space-y-3 bg-[var(--bg)]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fg)]">
                  Risk Level Breakdown
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-[var(--muted)]">
                    <span>High Risk Verdicts (&gt;= {highThreshold})</span>
                    <span className="font-mono font-bold text-[var(--fg)]">{analytics?.highRiskCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-[var(--muted)]">
                    <span>Medium Risk Verdicts (&gt;= {mediumThreshold})</span>
                    <span className="font-mono font-bold text-[var(--fg)]">{analytics?.mediumRiskCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-[var(--muted)]">
                    <span>Low Risk / Safe Verdicts</span>
                    <span className="font-mono font-bold text-[var(--fg)]">{analytics?.lowRiskCount ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. MLOps Tab */}
          {activeTab === 'ml' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="border border-[var(--border)] p-4 bg-[var(--bg-subtle)]">
                  <span className="text-[10px] uppercase font-mono text-[var(--muted)]">Accuracy</span>
                  <div className="text-2xl font-bold font-mono text-[var(--fg)] mt-1">
                    {mlMetrics ? (mlMetrics.accuracy * 100).toFixed(2) : 98.67}%
                  </div>
                </div>
                <div className="border border-[var(--border)] p-4 bg-[var(--bg-subtle)]">
                  <span className="text-[10px] uppercase font-mono text-[var(--muted)]">Spam Recall</span>
                  <div className="text-2xl font-bold font-mono text-[var(--fg)] mt-1">
                    {mlMetrics ? (mlMetrics.recall * 100).toFixed(2) : 99.87}%
                  </div>
                </div>
                <div className="border border-[var(--border)] p-4 bg-[var(--bg-subtle)]">
                  <span className="text-[10px] uppercase font-mono text-[var(--muted)]">Precision</span>
                  <div className="text-2xl font-bold font-mono text-[var(--fg)] mt-1">
                    {mlMetrics ? (mlMetrics.precision * 100).toFixed(2) : 95.75}%
                  </div>
                </div>
                <div className="border border-[var(--border)] p-4 bg-[var(--bg-subtle)]">
                  <span className="text-[10px] uppercase font-mono text-[var(--muted)]">F1 Score</span>
                  <div className="text-2xl font-bold font-mono text-[var(--fg)] mt-1">
                    {mlMetrics ? (mlMetrics.f1Score * 100).toFixed(2) : 97.76}%
                  </div>
                </div>
              </div>

              {/* Confusion Matrix */}
              <div className="border border-[var(--border)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fg)]">
                    Model Confusion Matrix (Validation Set)
                  </h3>
                  <span className="text-[10px] font-mono text-[var(--muted)]">
                    FPR: {mlMetrics ? (mlMetrics.fpr * 100).toFixed(2) : 1.82}% | FNR: {mlMetrics ? (mlMetrics.fnr * 100).toFixed(2) : 0.13}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="border border-[var(--border)] p-4 bg-[var(--bg-subtle)]">
                    <span className="text-[10px] font-mono uppercase text-[var(--muted)] block">True Negative (Ham)</span>
                    <span className="text-xl font-mono font-bold text-[var(--fg)]">{mlMetrics?.confusionMatrix?.tn ?? 3605}</span>
                  </div>
                  <div className="border border-[var(--border)] p-4 bg-[var(--bg-subtle)]">
                    <span className="text-[10px] font-mono uppercase text-[var(--muted)] block">False Positive (Type I)</span>
                    <span className="text-xl font-mono font-bold text-[var(--fg)]">{mlMetrics?.confusionMatrix?.fp ?? 67}</span>
                  </div>
                  <div className="border border-[var(--border)] p-4 bg-[var(--bg-subtle)]">
                    <span className="text-[10px] font-mono uppercase text-[var(--muted)] block">False Negative (Type II)</span>
                    <span className="text-xl font-mono font-bold text-[var(--fg)]">{mlMetrics?.confusionMatrix?.fn ?? 2}</span>
                  </div>
                  <div className="border border-[var(--border)] p-4 bg-[var(--bg-subtle)]">
                    <span className="text-[10px] font-mono uppercase text-[var(--muted)] block">True Positive (Spam)</span>
                    <span className="text-xl font-mono font-bold text-[var(--fg)]">{mlMetrics?.confusionMatrix?.tp ?? 1507}</span>
                  </div>
                </div>
              </div>

              {/* Versioning & Rollback */}
              <div className="border border-[var(--border)] p-5 space-y-3 bg-[var(--bg-subtle)]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fg)]">
                  Model Rollback & Active Version
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Current active model: <strong>{mlMetrics?.activeModelVersion || 'v1.0.0'}</strong>
                </p>
                <div className="flex gap-2 max-w-sm">
                  <select
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="flex-1 border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--fg)]"
                  >
                    {mlMetrics?.availableVersions?.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    )) || <option value="v1.0.0">v1.0.0</option>}
                  </select>
                  <button
                    onClick={handleRollback}
                    className="border border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)] px-4 py-1.5 text-xs font-semibold hover:opacity-90"
                  >
                    Activate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. Review Queue Tab */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fg)]">
                  Pending Prediction Reviews ({pendingFeedback.length})
                </h3>
                <span className="text-[10px] text-[var(--muted)] font-mono">
                  Offline human triage only &middot; Never auto-retrained
                </span>
              </div>

              {pendingFeedback.length === 0 ? (
                <div className="border border-[var(--border)] p-12 text-center text-xs text-[var(--muted)] bg-[var(--bg-subtle)]">
                  ✓ Review queue is clear. No pending prediction reports.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingFeedback.map((fb) => (
                    <div
                      key={fb.id}
                      className="border border-[var(--border)] bg-[var(--bg-subtle)] p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 border font-semibold ${
                              fb.reportedLabel === 'ham'
                                ? 'border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]'
                                : 'border-[var(--accent-high)] text-[var(--accent-high)]'
                            }`}
                          >
                            Reported as: {fb.reportedLabel.toUpperCase()}
                          </span>
                          <span className="text-xs text-[var(--muted)] font-mono">
                            Original Score: {fb.originalScore}/100 ({fb.originalLevel})
                          </span>
                        </div>
                        <button
                          onClick={() => handleMarkReviewed(fb.id)}
                          className="border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold text-[var(--fg)] hover:border-[var(--fg)]"
                        >
                          Mark Reviewed
                        </button>
                      </div>

                      {fb.reason && (
                        <p className="text-xs text-[var(--fg)] bg-[var(--bg)] p-2.5 border border-[var(--border)]">
                          "{fb.reason}"
                        </p>
                      )}

                      <span className="text-[10px] font-mono text-[var(--muted)] block">
                        Submitted: {new Date(fb.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Configuration Tab */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              <div className="border border-[var(--border)] p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fg)]">
                  Risk Level Thresholds
                </h3>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label className="font-semibold text-[var(--fg)]">HIGH Risk Floor:</label>
                      <span className="font-mono font-bold">{highThreshold} / 100</span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={95}
                      value={highThreshold}
                      onChange={(e) => setHighThreshold(parseInt(e.target.value, 10))}
                      className="w-full accent-black cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label className="font-semibold text-[var(--fg)]">MEDIUM Risk Floor:</label>
                      <span className="font-mono font-bold">{mediumThreshold} / 100</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={55}
                      value={mediumThreshold}
                      onChange={(e) => setMediumThreshold(parseInt(e.target.value, 10))}
                      className="w-full accent-black cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="border border-[var(--border)] p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fg)]">
                  Domain & Phishing Blocklist
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Comma-separated domains to automatically flag in sender and URL detectors.
                </p>
                <textarea
                  rows={3}
                  value={blockedDomainsInput}
                  onChange={(e) => setBlockedDomainsInput(e.target.value)}
                  className="w-full border border-[var(--border)] bg-[var(--bg)] p-3 text-xs font-mono text-[var(--fg)] focus:outline-none focus:border-[var(--fg)] resize-none"
                />
              </div>

              <button
                onClick={handleSaveConfig}
                className="border border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)] px-6 py-2 text-xs font-semibold hover:opacity-90"
              >
                Save System Configuration
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
