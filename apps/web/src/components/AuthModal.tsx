'use client';

import React, { useState } from 'react';
import { useDraftStore } from '@/store/useDraftStore';
import { requestMagicLink, verifyMagicLink, loginWithGoogleMock } from '@/lib/api';

export function AuthModal() {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    setCurrentUser,
  } = useDraftStore();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);
    setSentMessage(null);

    try {
      const res = await requestMagicLink(email.trim());
      setSentMessage('Magic link sent! Check your email inbox or use the link below.');
      if (res.token) {
        setDevToken(res.token);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch magic link');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDevToken = async () => {
    if (!devToken) return;
    setLoading(true);
    setError(null);
    try {
      const auth = await verifyMagicLink(devToken);
      setCurrentUser(auth.user);
      setIsAuthModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Failed to verify token');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleMock = async () => {
    setLoading(true);
    setError(null);
    try {
      const mockEmail = email.includes('@') ? email : 'google.user@example.com';
      const auth = await loginWithGoogleMock(mockEmail, 'google_oauth_sub_123');
      setCurrentUser(auth.user);
      setIsAuthModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md border border-[var(--border)] bg-[var(--bg)] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-5">
          <h2 className="text-base font-semibold tracking-wide text-[var(--fg)]">
            Sign In to SafeQuill
          </h2>
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="text-xs text-[var(--muted)] hover:text-[var(--fg)] p-1"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-[var(--muted)] mb-5 leading-relaxed">
          Sign in to save email drafts, review past scans, and export analysis reports.
          <strong> Any active guest draft is automatically claimed and saved to your account.</strong>
        </p>

        {error && (
          <div className="mb-4 border border-[var(--accent-high)] bg-[var(--accent-high)]/10 p-3 text-xs text-[var(--accent-high)]">
            {error}
          </div>
        )}

        {sentMessage ? (
          <div className="space-y-4">
            <div className="border border-[var(--border)] bg-[var(--bg-subtle)] p-4 text-xs text-[var(--fg)] space-y-2">
              <p className="font-semibold">{sentMessage}</p>
              <p className="text-[var(--muted)]">
                A verification link has been sent to <strong>{email}</strong> via Brevo.
              </p>
            </div>

            {devToken && (
              <div className="border border-dashed border-[var(--border)] p-3 space-y-2 bg-[var(--bg)]">
                <span className="text-[10px] uppercase font-mono text-[var(--muted)]">
                  Sandbox / Dev Mode Verification
                </span>
                <button
                  onClick={handleVerifyDevToken}
                  disabled={loading}
                  className="w-full border border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)] py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? 'Claiming Session...' : 'Instant Verify & Claim Draft'}
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setSentMessage(null);
                setDevToken(null);
              }}
              className="w-full text-xs text-[var(--muted)] hover:text-[var(--fg)] py-1"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendMagicLink} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--fg)] mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--fg)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full border border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)] py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Sending link...' : 'Send Magic Link'}
            </button>

            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]" />
              </div>
              <span className="relative bg-[var(--bg)] px-2 text-[10px] uppercase text-[var(--muted)]">
                Or
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleMock}
              disabled={loading}
              className="w-full border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--fg)] py-2 text-xs font-semibold hover:border-[var(--fg)] transition-colors flex items-center justify-center gap-2"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
