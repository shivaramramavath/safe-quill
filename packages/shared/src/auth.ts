export interface UserProfile {
  id: string;
  email: string;
  role?: 'admin' | 'user';
  googleId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedSession {
  id: string;
  userId: string;
  title: string;
  subject: string;
  body: string;
  rawHeaders?: string;
  analysisSnapshot?: {
    score: number;
    verdict: string;
    cuesCount?: number;
    timestamp: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MagicLinkRequest {
  email: string;
}

export interface VerifyMagicLinkRequest {
  email: string;
  token: string;
}

export interface SaveSessionRequest {
  title?: string;
  subject?: string;
  body?: string;
  rawHeaders?: string;
  analysisSnapshot?: {
    score: number;
    verdict: string;
    cuesCount?: number;
    timestamp: string;
  };
}

export interface RenameSessionRequest {
  title: string;
}

export interface SendReportRequest {
  recipientEmail: string;
  subject: string;
  body: string;
  score: number;
  verdict: string;
  cues: string[];
}

export interface AuthResponse {
  user: UserProfile;
  claimedSessionCount: number;
  message: string;
}

export interface UserExportData {
  user: UserProfile;
  sessions: SavedSession[];
  exportedAt: string;
}

export const AUTH_COOKIE_NAME = 'sq_auth_token';
