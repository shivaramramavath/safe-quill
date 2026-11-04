import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  GUEST_SESSION_TTL_SECONDS,
  GuestSession,
  SessionResponse,
} from '@safe-quill/shared';
import {
  SESSION_STORE_PORT,
  SessionStorePort,
} from '../../domain/ports/session-store.port';
import { GuestSessionEntity } from '../../domain/models/guest-session.entity';
import { UpdateDraftDto } from '../dtos/update-draft.dto';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @Inject(SESSION_STORE_PORT)
    private readonly sessionStore: SessionStorePort,
  ) {}

  async getOrCreateSession(
    existingSessionId?: string,
  ): Promise<{ session: GuestSession; isNew: boolean }> {
    if (existingSessionId) {
      const existing = await this.sessionStore.getSession(existingSessionId);
      if (existing) {
        return { session: existing, isNew: false };
      }
    }

    const newId = uuidv4();
    const entity = GuestSessionEntity.createNew(
      newId,
      GUEST_SESSION_TTL_SECONDS,
    );
    await this.sessionStore.saveSession(entity, GUEST_SESSION_TTL_SECONDS);

    this.logger.log(`Created new guest session: ${newId.substring(0, 8)}...`);
    return { session: entity, isNew: true };
  }

  async updateDraft(
    sessionId: string,
    dto: UpdateDraftDto,
  ): Promise<SessionResponse> {
    const existing = await this.sessionStore.getSession(sessionId);
    let entity: GuestSessionEntity;

    if (!existing) {
      entity = GuestSessionEntity.createNew(
        sessionId,
        GUEST_SESSION_TTL_SECONDS,
      );
    } else {
      entity = new GuestSessionEntity(
        existing.sessionId,
        existing.createdAt,
        existing.expiresAt,
        existing.draft,
      );
    }

    entity.updateDraft(dto.subject, dto.body, dto.rawHeaders);
    await this.sessionStore.saveSession(entity, GUEST_SESSION_TTL_SECONDS);

    return this.toResponse(entity);
  }

  async clearSession(sessionId: string): Promise<SessionResponse> {
    const existing = await this.sessionStore.getSession(sessionId);
    let entity: GuestSessionEntity;

    if (!existing) {
      entity = GuestSessionEntity.createNew(
        sessionId,
        GUEST_SESSION_TTL_SECONDS,
      );
    } else {
      entity = new GuestSessionEntity(
        existing.sessionId,
        existing.createdAt,
        existing.expiresAt,
        existing.draft,
      );
      entity.resetDraft();
    }

    await this.sessionStore.saveSession(entity, GUEST_SESSION_TTL_SECONDS);
    return this.toResponse(entity);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sessionStore.deleteSession(sessionId);
  }

  toResponse(session: GuestSession): SessionResponse {
    const now = Date.now();
    const expiresAtMs = new Date(session.expiresAt).getTime();
    const expiresInSeconds = Math.max(
      0,
      Math.floor((expiresAtMs - now) / 1000),
    );

    return {
      sessionId: session.sessionId,
      isGuest: true,
      draft: session.draft,
      expiresInSeconds,
    };
  }
}
