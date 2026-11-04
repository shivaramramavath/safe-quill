export interface DraftState {
  subject: string;
  body: string;
  rawHeaders?: string;
  updatedAt: string;
}

export interface GuestSession {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  draft: DraftState;
}

export interface UpdateDraftRequest {
  subject: string;
  body: string;
  rawHeaders?: string;
}

export interface SessionResponse {
  sessionId: string;
  isGuest: boolean;
  draft: DraftState;
  expiresInSeconds: number;
}

export const GUEST_COOKIE_NAME = 'sq_guest_session';
export const GUEST_SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours
