import { DraftState, GuestSession } from '@safe-quill/shared';

export class GuestSessionEntity implements GuestSession {
  constructor(
    public readonly sessionId: string,
    public readonly createdAt: string,
    public expiresAt: string,
    public draft: DraftState,
  ) {}

  static createNew(sessionId: string, ttlSeconds: number): GuestSessionEntity {
    const now = new Date();
    const expires = new Date(now.getTime() + ttlSeconds * 1000);
    return new GuestSessionEntity(
      sessionId,
      now.toISOString(),
      expires.toISOString(),
      {
        subject: '',
        body: '',
        updatedAt: now.toISOString(),
      },
    );
  }

  updateDraft(subject: string, body: string, rawHeaders?: string): void {
    const now = new Date().toISOString();
    this.draft = {
      subject,
      body,
      rawHeaders,
      updatedAt: now,
    };
  }

  resetDraft(): void {
    const now = new Date().toISOString();
    this.draft = {
      subject: '',
      body: '',
      updatedAt: now,
    };
  }
}
