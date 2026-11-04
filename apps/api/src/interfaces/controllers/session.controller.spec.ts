import { Test, TestingModule } from '@nestjs/testing';
import { SessionController } from './session.controller';
import { SessionService } from '../../application/services/session.service';
import { SESSION_STORE_PORT } from '../../domain/ports/session-store.port';
import { GuestSession } from '@safe-quill/shared';

describe('SessionController', () => {
  let controller: SessionController;
  let service: SessionService;

  beforeEach(async () => {
    const memory = new Map<string, GuestSession>();
    const mockStore = {
      getSession: jest.fn().mockImplementation(async (id: string) => memory.get(id) || null),
      saveSession: jest.fn().mockImplementation(async (s: GuestSession) => {
        memory.set(s.sessionId, s);
      }),
      deleteSession: jest.fn().mockImplementation(async (id: string) => {
        memory.delete(id);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        SessionService,
        {
          provide: SESSION_STORE_PORT,
          useValue: mockStore,
        },
      ],
    }).compile();

    controller = module.get<SessionController>(SessionController);
    service = module.get<SessionService>(SessionService);
  });

  it('retrieves existing session from request sessionId', async () => {
    const { session } = await service.getOrCreateSession();
    const mockReq = { guestSessionId: session.sessionId } as any;

    const res = await controller.getSession(mockReq);
    expect(res.sessionId).toBe(session.sessionId);
    expect(res.isGuest).toBe(true);
    expect(res.draft.body).toBe('');
  });

  it('updates draft via controller', async () => {
    const { session } = await service.getOrCreateSession();
    const mockReq = { guestSessionId: session.sessionId } as any;

    const res = await controller.updateDraft(mockReq, {
      subject: 'Hello World',
      body: 'This is a test email body',
    });

    expect(res.draft.subject).toBe('Hello World');
    expect(res.draft.body).toBe('This is a test email body');
  });
});
