import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SavedSession,
  SaveSessionRequest,
  UserExportData,
} from '@safe-quill/shared';
import {
  SAVED_SESSION_REPOSITORY_PORT,
  SavedSessionRepositoryPort,
} from '../../domain/ports/saved-session-repository.port';
import {
  USER_REPOSITORY_PORT,
  UserRepositoryPort,
} from '../../domain/ports/user-repository.port';

@Injectable()
export class SavedSessionService {
  constructor(
    @Inject(SAVED_SESSION_REPOSITORY_PORT)
    private readonly sessionRepo: SavedSessionRepositoryPort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepo: UserRepositoryPort,
  ) {}

  async list(userId: string): Promise<SavedSession[]> {
    return this.sessionRepo.findByUserId(userId);
  }

  async save(userId: string, data: SaveSessionRequest): Promise<SavedSession> {
    const title =
      data.title ||
      data.subject?.trim() ||
      data.body?.trim().slice(0, 40) ||
      'Untitled Email Draft';

    return this.sessionRepo.create({
      userId,
      title,
      subject: data.subject || '',
      body: data.body || '',
      rawHeaders: data.rawHeaders,
      analysisSnapshot: data.analysisSnapshot,
    });
  }

  async rename(
    userId: string,
    sessionId: string,
    title: string,
  ): Promise<SavedSession> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('Not authorized to modify this session');
    }

    const updated = await this.sessionRepo.update(sessionId, { title });
    if (!updated) {
      throw new NotFoundException('Session not found');
    }
    return updated;
  }

  async delete(userId: string, sessionId: string): Promise<boolean> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('Not authorized to delete this session');
    }

    return this.sessionRepo.delete(sessionId);
  }

  async exportUserData(userId: string): Promise<UserExportData> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const sessions = await this.sessionRepo.findByUserId(userId);
    return {
      user,
      sessions,
      exportedAt: new Date().toISOString(),
    };
  }

  async deleteAccount(
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete all user sessions
    await this.sessionRepo.deleteByUserId(userId);

    // Delete user account
    await this.userRepo.delete(userId);

    return {
      success: true,
      message: 'User account and all associated sessions have been permanently deleted.',
    };
  }
}
