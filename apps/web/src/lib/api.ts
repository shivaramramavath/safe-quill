import {
  AiFeedback,
  AnalyticsOverview,
  AuthResponse,
  CreateAiFeedbackRequest,
  CreatePredictionFeedbackRequest,
  GenerateSubjectsResponse,
  MlMetrics,
  PredictionFeedback,
  RewriteEmailRequest,
  RewriteEmailResponse,
  RiskAnalysisResult,
  SavedSession,
  SaveSessionRequest,
  SendReportRequest,
  SessionResponse,
  SystemConfig,
  ToneAnalysis,
  UpdateDraftRequest,
  UpdateSystemConfigRequest,
  UserExportData,
  UserProfile,
} from '@safe-quill/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function fetchCurrentSession(): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE}/api/v1/session`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch session: ${res.statusText}`);
  }

  return res.json();
}

export async function saveDraft(data: UpdateDraftRequest): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE}/api/v1/session/draft`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Failed to save draft: ${res.statusText}`);
  }

  return res.json();
}

export async function clearSessionDraft(): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE}/api/v1/session`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to clear session draft: ${res.statusText}`);
  }

  return res.json();
}

export async function analyzeEmail(
  data: { subject?: string; body: string; rawHeaders?: string },
  signal?: AbortSignal,
): Promise<RiskAnalysisResult> {
  const res = await fetch(`${API_BASE}/api/v1/analyze`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Failed to analyze email: ${res.statusText}`);
  }

  return res.json();
}

export async function requestRewrite(
  data: RewriteEmailRequest,
): Promise<RewriteEmailResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/rewrite`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(errorJson.message || `Failed to rewrite email: ${res.statusText}`);
  }

  return res.json();
}

export async function requestTone(text: string): Promise<ToneAnalysis> {
  const res = await fetch(`${API_BASE}/api/v1/ai/tone`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error(`Failed to analyze tone: ${res.statusText}`);
  }

  return res.json();
}

export async function requestSubjects(body: string): Promise<GenerateSubjectsResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/subjects`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    throw new Error(`Failed to generate subjects: ${res.statusText}`);
  }

  return res.json();
}

export async function streamRewriteEmail(
  data: RewriteEmailRequest,
  onToken: (token: string) => void,
  onComplete: (res: RewriteEmailResponse) => void,
  onError: (err: string) => void,
): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/stream-rewrite`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Stream request failed: ${res.statusText}`);
    }

    if (!res.body) {
      throw new Error('ReadableStream not supported by browser');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.replace('data: ', ''));
            if (parsed.type === 'token') {
              onToken(parsed.data);
            } else if (parsed.type === 'complete') {
              onComplete(parsed.data);
            } else if (parsed.type === 'error') {
              onError(parsed.data);
            }
          } catch {
            // Ignore malformed chunk
          }
        }
      }
    }
  } catch (err: any) {
    onError(err.message || 'Streaming connection failed');
  }
}

// ---------------- Phase 5: Auth, Saved Sessions, Mailer & GDPR ----------------

export async function requestMagicLink(
  email: string,
): Promise<{ success: boolean; message: string; token?: string }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/magic-link`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Failed to request login link');
  }

  return res.json();
}

export async function verifyMagicLink(token: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Failed to verify login link');
  }

  return res.json();
}

export async function loginWithGoogleMock(
  email: string,
  googleId: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/google`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, googleId }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Failed to sign in with Google');
  }

  return res.json();
}

export async function fetchCurrentUser(): Promise<{ user: UserProfile } | null> {
  const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status === 401) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch user: ${res.statusText}`);
  }

  return res.json();
}

export async function logoutUser(): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Logout failed: ${res.statusText}`);
  }

  return res.json();
}

export async function fetchSavedSessions(): Promise<SavedSession[]> {
  const res = await fetch(`${API_BASE}/api/v1/sessions/saved`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status === 401) {
    return [];
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch saved sessions: ${res.statusText}`);
  }

  return res.json();
}

export async function saveDraftToAccount(
  data: SaveSessionRequest,
): Promise<SavedSession> {
  const res = await fetch(`${API_BASE}/api/v1/sessions/saved`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Failed to save session');
  }

  return res.json();
}

export async function renameSavedSession(
  id: string,
  title: string,
): Promise<SavedSession> {
  const res = await fetch(`${API_BASE}/api/v1/sessions/saved/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    throw new Error(`Failed to rename session: ${res.statusText}`);
  }

  return res.json();
}

export async function deleteSavedSession(
  id: string,
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/v1/sessions/saved/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to delete session: ${res.statusText}`);
  }

  return res.json();
}

export async function sendReportEmail(
  data: SendReportRequest,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/mailer/report`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Failed to dispatch report email');
  }

  return res.json();
}

export async function exportAccountData(): Promise<UserExportData> {
  const res = await fetch(`${API_BASE}/api/v1/account/export`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to export data: ${res.statusText}`);
  }

  return res.json();
}

export async function deleteAccountData(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/account`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to delete account: ${res.statusText}`);
  }

  return res.json();
}

// ---------------- Phase 6: Feedback, Analytics & Admin ----------------

export async function submitPredictionFeedback(
  data: CreatePredictionFeedbackRequest,
): Promise<{ success: boolean; message: string; feedbackId: string }> {
  const res = await fetch(`${API_BASE}/api/v1/feedback/prediction`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Failed to submit prediction feedback');
  }

  return res.json();
}

export async function submitAiFeedback(
  data: CreateAiFeedbackRequest,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/feedback/ai`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Failed to submit AI feedback: ${res.statusText}`);
  }

  return res.json();
}

export async function fetchAdminAnalytics(): Promise<AnalyticsOverview> {
  const res = await fetch(`${API_BASE}/api/v1/admin/analytics`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch admin analytics: ${res.statusText}`);
  }

  return res.json();
}

export async function fetchPendingFeedback(): Promise<PredictionFeedback[]> {
  const res = await fetch(`${API_BASE}/api/v1/admin/feedback`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch feedback review queue: ${res.statusText}`);
  }

  return res.json();
}

export async function markFeedbackReviewed(
  id: string,
): Promise<PredictionFeedback> {
  const res = await fetch(`${API_BASE}/api/v1/admin/feedback/${id}/review`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to mark feedback as reviewed: ${res.statusText}`);
  }

  return res.json();
}

export async function fetchSystemConfig(): Promise<SystemConfig> {
  const res = await fetch(`${API_BASE}/api/v1/admin/config`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch system config: ${res.statusText}`);
  }

  return res.json();
}

export async function updateSystemConfig(
  data: UpdateSystemConfigRequest,
): Promise<SystemConfig> {
  const res = await fetch(`${API_BASE}/api/v1/admin/config`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Failed to update system config');
  }

  return res.json();
}

export async function fetchMlMetrics(): Promise<MlMetrics> {
  const res = await fetch(`${API_BASE}/api/v1/admin/ml/metrics`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ML metrics: ${res.statusText}`);
  }

  return res.json();
}

export async function rollbackMlModel(
  version: string,
): Promise<{ success: boolean; activeVersion: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/admin/ml/rollback`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version }),
  });

  if (!res.ok) {
    throw new Error(`Failed to rollback model version: ${res.statusText}`);
  }

  return res.json();
}
