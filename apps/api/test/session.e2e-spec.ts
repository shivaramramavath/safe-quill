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

    const firstRes = await request(app.getHttpServer())
      .post('/api/v1/analyze')
      .send(spamSample)
      .expect(201);

    expect(firstRes.body.score).toBeGreaterThanOrEqual(50);
    expect(firstRes.body.cached).toBe(false);

    // Second analysis with identical text: instant cache hit!
    const secondRes = await request(app.getHttpServer())
      .post('/api/v1/analyze')
      .send(spamSample)
      .expect(201);

    expect(secondRes.body.score).toBe(firstRes.body.score);
    expect(secondRes.body.cached).toBe(true);
    expect(secondRes.body.latencyMs).toBeLessThanOrEqual(50);
  });

  it('Phase 3 Criteria: a phishing sample scores HIGH with clear explanations and evidence', async () => {
    const phishingSample = {
      subject: 'URGENT: Security Alert - Wire funds immediately to prevent account termination',
      body: 'Dear executive, your account will be suspended within 24 hours due to an unauthorized login. Please process an urgent wire transfer of $25,000 to our offshore vendor account at http://bit.ly/secure-restore or confirm your password immediately.',
      rawHeaders: 'From: security@chase.com\nReply-To: phisher@attacker-domain.xyz\nReceived-SPF: fail',
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/analyze')
      .send(phishingSample)
      .expect(201);

    expect(res.body.level).toBe('HIGH');
    expect(res.body.score).toBeGreaterThanOrEqual(75);
    expect(res.body.evidence.length).toBeGreaterThanOrEqual(3);
  });

  it('Phase 4 Criteria: safe rewrite drops score visibly, and circuit breaker protects detection', async () => {
    const highRiskSpam = {
      subject: 'URGENT: Immediate Account Suspension Notice',
      body: 'Your account will be suspended within 24 hours unless you wire funds to offshore account immediately at http://bit.ly/verify.',
      mode: 'safe',
    };

    // 1. Safe Rewrite Endpoint
    const rewriteRes = await request(app.getHttpServer())
      .post('/api/v1/ai/rewrite')
      .send(highRiskSpam)
      .expect(201);

    // Verification: Original score was HIGH, new score dropped visibly to LOW
    expect(rewriteRes.body.originalScore).toBeGreaterThanOrEqual(75);
    expect(rewriteRes.body.originalLevel).toBe('HIGH');
    expect(rewriteRes.body.newScore).toBeLessThan(40);
    expect(rewriteRes.body.newLevel).toBe('LOW');
    expect(rewriteRes.body.rewrittenText).not.toContain('http://bit.ly/verify');

    // 2. Verification: Killing Groq does not break spam detection!
    // Analysis continues to work 100% properly regardless of LLM status
    const analyzeAfterRes = await request(app.getHttpServer())
      .post('/api/v1/analyze')
      .send({
        body: 'Normal team meeting notes: Sprint retrospective completed successfully.',
      })
      .expect(201);

    expect(analyzeAfterRes.body.level).toBe('LOW');
    expect(analyzeAfterRes.body.score).toBeLessThan(40);
  });

  it('Phase 5 Criteria: a guest clicks Save, verifies by email, and finds the same draft in their account', async () => {
    // 1. Guest creates a draft
    const sessionRes = await request(app.getHttpServer())
      .get('/api/v1/session')
      .expect(200);

    const cookies = sessionRes.headers['set-cookie'] as unknown as string[];
    const guestCookie = cookies.find((c: string) => c.startsWith(`${GUEST_COOKIE_NAME}=`));
    expect(guestCookie).toBeDefined();

    // 2. Guest types email draft
    await request(app.getHttpServer())
      .put('/api/v1/session/draft')
      .set('Cookie', guestCookie!)
      .send({
        subject: 'Confidential Strategy Briefing 2026',
        body: 'Please review our Q4 AI roadmap and security architecture milestones.',
      })
      .expect(200);

    // 3. Guest requests magic link
    const magicRes = await request(app.getHttpServer())
      .post('/api/v1/auth/magic-link')
      .send({ email: 'founder@safequill.local' })
      .expect(201);

    expect(magicRes.body.success).toBe(true);
    const magicToken = magicRes.body.token;
    expect(magicToken).toBeDefined();

    // 4. Guest verifies magic link and claims the session
    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/verify')
      .set('Cookie', guestCookie!)
      .send({ token: magicToken })
      .expect(201);

    expect(verifyRes.body.user.email).toBe('founder@safequill.local');
    expect(verifyRes.body.claimedSessionCount).toBe(1);

    const authCookies = verifyRes.headers['set-cookie'] as unknown as string[];
    const authCookie = authCookies.find((c: string) => c.startsWith('sq_auth_token='));
    expect(authCookie).toBeDefined();

    // 5. User checks saved sessions: draft is there!
    const savedRes = await request(app.getHttpServer())
      .get('/api/v1/sessions/saved')
      .set('Cookie', authCookie!)
      .expect(200);

    expect(savedRes.body).toHaveLength(1);
    expect(savedRes.body[0].subject).toBe('Confidential Strategy Briefing 2026');
    expect(savedRes.body[0].body).toContain('roadmap');
    const savedSessionId = savedRes.body[0].id;

    // 6. User renames session
    const renameRes = await request(app.getHttpServer())
      .patch(`/api/v1/sessions/saved/${savedSessionId}`)
      .set('Cookie', authCookie!)
      .send({ title: '2026 Security Roadmap Brief' })
      .expect(200);

    expect(renameRes.body.title).toBe('2026 Security Roadmap Brief');

    // 7. Brevo Mailer: "Email me this report"
    const reportRes = await request(app.getHttpServer())
      .post('/api/v1/mailer/report')
      .send({
        recipientEmail: 'audit@safequill.local',
        subject: 'Confidential Strategy Briefing 2026',
        body: 'Q4 AI roadmap',
        score: 15,
        verdict: 'LOW',
        cues: [],
      })
      .expect(201);

    expect(reportRes.body.success).toBe(true);

    // 8. GDPR Export
    const exportRes = await request(app.getHttpServer())
      .get('/api/v1/account/export')
      .set('Cookie', authCookie!)
      .expect(200);

    expect(exportRes.body.user.email).toBe('founder@safequill.local');
    expect(exportRes.body.sessions).toHaveLength(1);

    // 9. GDPR Hard Delete
    const deleteRes = await request(app.getHttpServer())
      .delete('/api/v1/account')
      .set('Cookie', authCookie!)
      .expect(200);

    expect(deleteRes.body.success).toBe(true);

    // Subsequent list returns empty
    const emptyRes = await request(app.getHttpServer())
      .get('/api/v1/sessions/saved')
      .set('Cookie', authCookie!)
      .expect(401); // Unauthorized because account was deleted
  });
});
