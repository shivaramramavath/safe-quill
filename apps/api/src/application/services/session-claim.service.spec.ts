import { SessionClaimService } from './session-claim.service';
import { SessionStorePort } from '../../domain/ports/session-store.port';
import { SavedSessionRepositoryPort } from '../../domain/ports/saved-session-repository.port';
import { GuestSession } from '@safe-quill/shared';

describe('SessionClaimService', () => {
  let service: SessionClaimService;
  let mockStore: jest.Mocked<SessionStorePort>;
  let mockRepo: jest.Mocked<SavedSessionRepositoryPort>;

  beforeEach(() => {
    mockStore = {
      getSession: jest.fn(),
      saveSession: jest.fn(),
      deleteSession: jest.fn(),
    };

    mockRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteByUserId: jest.fn(),
    };

    service = new SessionClaimService(mockStore, mockRepo);
  });

  it('should return claimed=false if no guestSessionId is provided', async () => {
    const res = await service.claimGuestSession('user-123', undefined);
    expect(res.claimed).toBe(false);
    expect(mockStore.getSession).not.toHaveBeenCalled();
  });

  it('should return claimed=false if guest session is not found in store', async () => {
    mockStore.getSession.mockResolvedValue(null);

    const res = await service.claimGuestSession('user-123', 'guest-abc');
    expect(res.claimed).toBe(false);
    expect(mockStore.getSession).toHaveBeenCalledWith('guest-abc');
  });

  it('should delete guest session without saving if draft is empty', async () => {
    const emptyGuest: GuestSession = {
      sessionId: 'guest-empty',
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      draft: { subject: '', body: '', updatedAt: new Date().toISOString() },
    };
    mockStore.getSession.mockResolvedValue(emptyGuest);

    const res = await service.claimGuestSession('user-123', 'guest-empty');
    expect(res.claimed).toBe(false);
    expect(mockStore.deleteSession).toHaveBeenCalledWith('guest-empty');
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('should claim guest session with draft content, save to repo, and delete from store', async () => {
    const populatedGuest: GuestSession = {
      sessionId: 'guest-1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      draft: {
        subject: 'Quarterly review report',
        body: 'Please review the attached quarterly metrics.',
        rawHeaders: 'From: boss@corp.com',
        updatedAt: new Date().toISOString(),
      },
    };
    mockStore.getSession.mockResolvedValue(populatedGuest);

    mockRepo.create.mockResolvedValue({
      id: 'saved-1',
      userId: 'user-123',
      title: 'Quarterly review report',
      subject: 'Quarterly review report',
      body: 'Please review the attached quarterly metrics.',
      rawHeaders: 'From: boss@corp.com',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await service.claimGuestSession('user-123', 'guest-1');
    expect(res.claimed).toBe(true);
    expect(res.session?.title).toBe('Quarterly review report');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        title: 'Quarterly review report',
        subject: 'Quarterly review report',
        body: 'Please review the attached quarterly metrics.',
      }),
    );
    expect(mockStore.deleteSession).toHaveBeenCalledWith('guest-1');
  });
});
