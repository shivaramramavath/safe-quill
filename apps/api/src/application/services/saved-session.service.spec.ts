import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SavedSessionService } from './saved-session.service';
import { SavedSessionRepositoryPort } from '../../domain/ports/saved-session-repository.port';
import { UserRepositoryPort } from '../../domain/ports/user-repository.port';

describe('SavedSessionService', () => {
  let service: SavedSessionService;
  let mockSessionRepo: jest.Mocked<SavedSessionRepositoryPort>;
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;

  beforeEach(() => {
    mockSessionRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteByUserId: jest.fn(),
    };

    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };

    service = new SavedSessionService(mockSessionRepo, mockUserRepo);
  });

  it('should list sessions for a user', async () => {
    mockSessionRepo.findByUserId.mockResolvedValue([
      {
        id: 's-1',
        userId: 'u-1',
        title: 'Draft 1',
        subject: 'Hello',
        body: 'Body text',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const res = await service.list('u-1');
    expect(res).toHaveLength(1);
    expect(mockSessionRepo.findByUserId).toHaveBeenCalledWith('u-1');
  });

  it('should rename a session if user is the owner', async () => {
    mockSessionRepo.findById.mockResolvedValue({
      id: 's-1',
      userId: 'u-1',
      title: 'Old title',
      subject: '',
      body: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    mockSessionRepo.update.mockResolvedValue({
      id: 's-1',
      userId: 'u-1',
      title: 'Renamed title',
      subject: '',
      body: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const updated = await service.rename('u-1', 's-1', 'Renamed title');
    expect(updated.title).toBe('Renamed title');
  });

  it('should throw ForbiddenException when renaming another user session', async () => {
    mockSessionRepo.findById.mockResolvedValue({
      id: 's-other',
      userId: 'other-user',
      title: 'Secret draft',
      subject: '',
      body: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(service.rename('u-1', 's-other', 'Hacked Title')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should export all user data and sessions for GDPR export', async () => {
    mockUserRepo.findById.mockResolvedValue({
      id: 'u-1',
      email: 'user@example.com',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    mockSessionRepo.findByUserId.mockResolvedValue([
      {
        id: 's-1',
        userId: 'u-1',
        title: 'Draft 1',
        subject: 'Sub',
        body: 'Text',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const exported = await service.exportUserData('u-1');
    expect(exported.user.email).toBe('user@example.com');
    expect(exported.sessions).toHaveLength(1);
    expect(exported.exportedAt).toBeDefined();
  });

  it('should delete user and all user sessions for GDPR account deletion', async () => {
    mockUserRepo.findById.mockResolvedValue({
      id: 'u-1',
      email: 'user@example.com',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockSessionRepo.deleteByUserId.mockResolvedValue(3);
    mockUserRepo.delete.mockResolvedValue(true);

    const res = await service.deleteAccount('u-1');
    expect(res.success).toBe(true);
    expect(mockSessionRepo.deleteByUserId).toHaveBeenCalledWith('u-1');
    expect(mockUserRepo.delete).toHaveBeenCalledWith('u-1');
  });
});
