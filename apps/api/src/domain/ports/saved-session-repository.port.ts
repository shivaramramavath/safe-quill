import { SavedSession } from '@safe-quill/shared';

export const SAVED_SESSION_REPOSITORY_PORT = Symbol('SAVED_SESSION_REPOSITORY_PORT');

export interface CreateSavedSessionDto {
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
}

export interface SavedSessionRepositoryPort {
  findByUserId(userId: string): Promise<SavedSession[]>;
  findById(id: string): Promise<SavedSession | null>;
  create(data: CreateSavedSessionDto): Promise<SavedSession>;
  update(
    id: string,
    updates: Partial<Pick<SavedSession, 'title' | 'subject' | 'body' | 'rawHeaders' | 'analysisSnapshot'>>,
  ): Promise<SavedSession | null>;
  delete(id: string): Promise<boolean>;
  deleteByUserId(userId: string): Promise<number>;
}
