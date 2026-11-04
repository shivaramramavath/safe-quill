import { UserProfile } from '@safe-quill/shared';

export const USER_REPOSITORY_PORT = Symbol('USER_REPOSITORY_PORT');

export interface UserRepositoryPort {
  findById(id: string): Promise<UserProfile | null>;
  findByEmail(email: string): Promise<UserProfile | null>;
  create(email: string, googleId?: string): Promise<UserProfile>;
  delete(id: string): Promise<boolean>;
}
