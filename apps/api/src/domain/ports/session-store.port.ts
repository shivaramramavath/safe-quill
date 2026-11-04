import { GuestSession } from '@safe-quill/shared';

export const SESSION_STORE_PORT = Symbol('SessionStorePort');

export interface SessionStorePort {
  getSession(sessionId: string): Promise<GuestSession | null>;
  saveSession(session: GuestSession, ttlSeconds?: number): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}
