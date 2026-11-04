'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDraftStore } from '@/store/useDraftStore';
import { verifyMagicLink } from '@/lib/api';

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const { setCurrentUser } = useDraftStore();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your sign-in link...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing authentication token');
      return;
    }

    verifyMagicLink(token)
      .then((res) => {
        setCurrentUser(res.user);
        setStatus('success');
        setMessage(res.message || 'Authenticated successfully! Redirecting...');
        setTimeout(() => {
          router.push('/');
        }, 1500);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || 'Verification failed or link expired');
      });
  }, [token, router, setCurrentUser]);

  return (
    <div className="w-full max-w-sm border border-[var(--border)] p-6 text-center space-y-4 bg-[var(--bg-subtle)]">
      <h1 className="text-base font-bold tracking-wide">SafeQuill Sign-In</h1>

      {status === 'verifying' && (
        <div className="space-y-2 py-4">
          <div className="h-4 w-4 mx-auto border-2 border-[var(--fg)] border-t-transparent animate-spin rounded-full" />
          <p className="text-xs text-[var(--muted)]">{message}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-2 py-4">
          <p className="text-sm font-semibold text-[var(--fg)]">✓ {message}</p>
          <p className="text-xs text-[var(--muted)]">Transferring to editor...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4 py-2">
          <div className="border border-[var(--accent-high)] bg-[var(--accent-high)]/10 p-3 text-xs text-[var(--accent-high)]">
            {message}
          </div>
          <button
            onClick={() => router.push('/')}
            className="border border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)] px-4 py-2 text-xs font-semibold"
          >
            Return to SafeQuill
          </button>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4 text-[var(--fg)]">
      <Suspense
        fallback={
          <div className="text-xs text-[var(--muted)]">
            Loading verification token...
          </div>
        }
      >
        <VerifyContent />
      </Suspense>
    </div>
  );
}
