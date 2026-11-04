import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from './session.service';
import { SESSION_STORE_PORT, SessionStorePort } from '../../domain/ports/session-store.port';
import { GuestSession } from '@safe-quill/shared';

describe('SessionService', () => {
  let service: SessionService;
  let mockStore: jest.Mocked<SessionStorePort>;

  beforeEach(async () => {
    const memory = new Map<string, GuestSession>();
    mockStore = {
      getSession: jest.fn().mockImplementation(async (id: string) => memory.get(id) || null),
      saveSession: jest.fn().mockImplementation(async (s: GuestSession) => {
        memory.set(s.sessionId, s);
      }),
      deleteSession: jest.fn().mockImplementation(async (id: string) => {
        memory.delete(id);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: SESSION_STORE_PORT,
          useValue: mockStore,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  it('creates a new guest session when no existing sessionId is provided', async () => {
    const { session, isNew } = await service.getOrCreateSession();

    expect(isNew).toBe(true);
    expect(session.sessionId).toBeDefined();
    expect(session.draft.subject).toBe('');
    expect(session.draft.body).toBe('');
    expect(mockStore.saveSession).toHaveBeenCalledTimes(1);
  });

  it('retrieves existing session if present in store', async () => {
    const { session: created } = await service.getOrCreateSession();
    const { session: fetched, isNew } = await service.getOrCreateSession(created.sessionId);

    expect(isNew).toBe(false);
    expect(fetched.sessionId).toBe(created.sessionId);
  });

  it('updates draft contents cleanly', async () => {
    const { session } = await service.getOrCreateSession();
    const updated = await service.updateDraft(session.sessionId, {
      subject: 'Urgent meeting notice',
      body: 'Please review the updated project proposal.',
    });

    expect(updated.draft.subject).toBe('Urgent meeting notice');
    expect(updated.draft.body).toBe('Please review the updated project proposal.');
  });

  it('clears draft contents when requested', async () => {
    const { session } = await service.getOrCreateSession();
    await service.updateDraft(session.sessionId, {
      subject: 'Test Subject',
      body: 'Test Body',
    });

    const cleared = await service.clearSession(session.sessionId);
    expect(cleared.draft.subject).toBe('');
    expect(cleared.draft.body).toBe('');
  });
});
