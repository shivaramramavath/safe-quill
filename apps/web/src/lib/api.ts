import {
  GenerateSubjectsResponse,
  RewriteEmailRequest,
  RewriteEmailResponse,
  RiskAnalysisResult,
  SessionResponse,
  ToneAnalysis,
  UpdateDraftRequest,
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
