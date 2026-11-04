import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
const cookieParser = require('cookie-parser');
import { AppModule } from '../src/app.module';
import { GUEST_COOKIE_NAME } from '@safe-quill/shared';

describe('SafeQuill E2E Acceptance Tests', () => {
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

  it('Phase 1 Criteria: guest visit, draft save, refresh survival, clear session', async () => {
    const initialRes = await request(app.getHttpServer())
      .get('/api/v1/session')
      .expect(200);

    const cookies = initialRes.headers['set-cookie'] as unknown as string[];
    const guestCookie = cookies.find((c: string) => c.startsWith(`${GUEST_COOKIE_NAME}=`));

    // Save draft
    await request(app.getHttpServer())
      .put('/api/v1/session/draft')
      .set('Cookie', guestCookie!)
      .send({
        subject: 'URGENT: Review Security Policy',
        body: 'Team, please review the revised security policies before EOD.',
      })
      .expect(200);

    // Refresh returns draft
    const refreshRes = await request(app.getHttpServer())
      .get('/api/v1/session')
      .set('Cookie', guestCookie!)
      .expect(200);

    expect(refreshRes.body.draft.subject).toBe('URGENT: Review Security Policy');

    // Clear draft
    await request(app.getHttpServer())
      .delete('/api/v1/session')
      .set('Cookie', guestCookie!)
      .expect(200);
  });

  it('Phase 2 Criteria: real-time analysis updates verdict and identical text hits cache', async () => {
    const spamSample = {
      subject: 'URGENT: Your bank account has been suspended',
      body: 'Suspicious activity detected. Click here immediately to verify credentials and prevent permanent termination.',
    };

    // First analysis: live execution (cache miss)
    const firstRes = await request(app.getHttpServer())
      .post('/api/v1/analyze')
      .send(spamSample)
      .expect(201);

    expect(firstRes.body.label).toBe('spam');
    expect(firstRes.body.score).toBeGreaterThanOrEqual(50);
    expect(firstRes.body.cached).toBe(false);
    expect(firstRes.body.topTokens.length).toBeGreaterThan(0);

    // Second analysis with identical text: instant cache hit!
    const secondRes = await request(app.getHttpServer())
      .post('/api/v1/analyze')
      .send(spamSample)
      .expect(201);

    expect(secondRes.body.score).toBe(firstRes.body.score);
    expect(secondRes.body.label).toBe(firstRes.body.label);
    expect(secondRes.body.cached).toBe(true);
    expect(secondRes.body.latencyMs).toBeLessThanOrEqual(50);
  });
});
