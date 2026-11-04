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

    expect(firstRes.body.label || firstRes.body.isSpam !== undefined).toBeTruthy();
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

    // High risk requirements
    expect(res.body.level).toBe('HIGH');
    expect(res.body.score).toBeGreaterThanOrEqual(75);
    expect(res.body.isSpam).toBe(true);

    // Explanations & Evidence verification
    expect(res.body.evidence).toBeDefined();
    expect(res.body.evidence.length).toBeGreaterThanOrEqual(3);

    const detectorNames = res.body.evidence.map((e: any) => e.detectorName);
    expect(detectorNames).toContain('BecPatternDetector');
    expect(detectorNames).toContain('UrgencySocialEngineeringDetector');
    expect(detectorNames).toContain('UrlAnalysisDetector');

    // Evidence must contain actionable human explanations and underline styles
    const becEvidence = res.body.evidence.find((e: any) => e.detectorName === 'BecPatternDetector');
    expect(becEvidence.reason).toContain('BEC Wire Fraud');
    expect(becEvidence.underlines.length).toBeGreaterThan(0);
    expect(becEvidence.underlines[0].type).toBe('solid');
  });
});
