import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
const cookieParser = require('cookie-parser');
import { AppModule } from '../src/app.module';
import { GUEST_COOKIE_NAME } from '@safe-quill/shared';

describe('Guest Session E2E (Phase 1 Acceptance Criteria)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Done When: user visits, types email, refreshes (gets draft intact), and can clear it', async () => {
    // 1. Visit app: GET /api/v1/session creates guest session and sets cookie
    const initialRes = await request(app.getHttpServer())
      .get('/api/v1/session')
      .expect(200);

    expect(initialRes.body.sessionId).toBeDefined();
    expect(initialRes.body.isGuest).toBe(true);
    expect(initialRes.body.draft.body).toBe('');

    // Extract cookie
    const cookies = initialRes.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    const guestCookie = cookies.find((c: string) => c.startsWith(`${GUEST_COOKIE_NAME}=`));
    expect(guestCookie).toBeDefined();

    // 2. Type an email: PUT /api/v1/session/draft
    const updateRes = await request(app.getHttpServer())
      .put('/api/v1/session/draft')
      .set('Cookie', guestCookie!)
      .send({
        subject: 'URGENT: Review Security Policy',
        body: 'Team, please review the revised security policies before EOD.',
      })
      .expect(200);

    expect(updateRes.body.draft.subject).toBe('URGENT: Review Security Policy');
    expect(updateRes.body.draft.body).toBe('Team, please review the revised security policies before EOD.');

    // 3. Refresh page: GET /api/v1/session with cookie should return the draft intact
    const refreshRes = await request(app.getHttpServer())
      .get('/api/v1/session')
      .set('Cookie', guestCookie!)
      .expect(200);

    expect(refreshRes.body.sessionId).toBe(initialRes.body.sessionId);
    expect(refreshRes.body.draft.subject).toBe('URGENT: Review Security Policy');
    expect(refreshRes.body.draft.body).toBe('Team, please review the revised security policies before EOD.');

    // 4. Clear session: DELETE /api/v1/session resets draft
    const clearRes = await request(app.getHttpServer())
      .delete('/api/v1/session')
      .set('Cookie', guestCookie!)
      .expect(200);

    expect(clearRes.body.draft.subject).toBe('');
    expect(clearRes.body.draft.body).toBe('');

    // 5. Subsequent refresh confirms draft is now empty
    const verifyClearedRes = await request(app.getHttpServer())
      .get('/api/v1/session')
      .set('Cookie', guestCookie!)
      .expect(200);

    expect(verifyClearedRes.body.draft.body).toBe('');
  });
});
