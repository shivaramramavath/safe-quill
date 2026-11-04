import { Inject, Injectable, Logger } from '@nestjs/common';
import { SavedSession } from '@safe-quill/shared';
import {
  SESSION_STORE_PORT,
  SessionStorePort,
} from '../../domain/ports/session-store.port';
import {
  SAVED_SESSION_REPOSITORY_PORT,
  SavedSessionRepositoryPort,
} from '../../domain/ports/saved-session-repository.port';
import { SessionClaimedEvent } from '../../domain/events/session-events';

@Injectable()
export class SessionClaimService {
  private readonly logger = new Logger(SessionClaimService.name);

  constructor(
    @Inject(SESSION_STORE_PORT)
    private readonly sessionStore: SessionStorePort,
    @Inject(SAVED_SESSION_REPOSITORY_PORT)
    private readonly savedSessionRepo: SavedSessionRepositoryPort,
  ) {}

  /**
   * Claims an ephemeral guest session, converts it into a permanent SavedSession,
   * and purges the guest session from Redis.
   */
  async claimGuestSession(
    userId: string,
    guestSessionId?: string,
  ): Promise<{ claimed: boolean; session?: SavedSession }> {
    if (!guestSessionId) {
      return { claimed: false };
    }

    const guestSession = await this.sessionStore.getSession(guestSessionId);
    if (!guestSession) {
      return { claimed: false };
    }

    const { draft } = guestSession;
    const hasContent =
      (draft.subject && draft.subject.trim().length > 0) ||
      (draft.body && draft.body.trim().length > 0);

    if (!hasContent) {
      // Empty draft, just clear the ephemeral session
      await this.sessionStore.deleteSession(guestSessionId);
      return { claimed: false };
    }

    // Determine an initial title from subject or first 40 chars of body
    const title = draft.subject.trim() || draft.body.trim().slice(0, 40) || 'Claimed Guest Draft';

    const saved = await this.savedSessionRepo.create({
      userId,
      title,
      subject: draft.subject,
      body: draft.body,
      rawHeaders: draft.rawHeaders,
    });

    // Delete ephemeral guest session from store (Redis)
    await this.sessionStore.deleteSession(guestSessionId);

    this.logger.log(
      `Claimed guest session ${guestSessionId} for user ${userId} -> saved session ${saved.id}`,
    );

    // Event
    new SessionClaimedEvent(userId, guestSessionId, saved.id);

    return { claimed: true, session: saved };
  }
}
