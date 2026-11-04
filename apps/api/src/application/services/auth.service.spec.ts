import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import { MailerPort } from '../../domain/ports/mailer.port';
import { SessionClaimService } from './session-claim.service';

describe('AuthService', () => {
  let service: AuthService;
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;
  let mockMailer: jest.Mocked<MailerPort>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockConfig: jest.Mocked<ConfigService>;
  let mockSessionClaimService: jest.Mocked<SessionClaimService>;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };

    mockMailer = {
      sendMagicLink: jest.fn().mockResolvedValue(true),
      sendAnalysisReport: jest.fn().mockResolvedValue(true),
      sendSecurityAlert: jest.fn().mockResolvedValue(true),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn().mockReturnValue({ sub: 'user-1', email: 'test@example.com' }),
    } as any;

    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'WEB_BASE_URL') return 'http://localhost:3000';
        return undefined;
      }),
    } as any;

    mockSessionClaimService = {
      claimGuestSession: jest.fn().mockResolvedValue({ claimed: false }),
    } as any;

    service = new AuthService(
      mockUserRepo,
      mockMailer,
      mockJwtService,
      mockConfig,
      mockSessionClaimService,
    );
  });

  it('should generate and dispatch a magic link email', async () => {
    const res = await service.requestMagicLink('test@example.com');
    expect(res.success).toBe(true);
    expect(res.token).toBeDefined();
    expect(mockMailer.sendMagicLink).toHaveBeenCalledWith(
      'test@example.com',
      expect.stringContaining(res.token!),
    );
  });

  it('should throw UnauthorizedException if magic token is invalid', async () => {
    await expect(service.verifyMagicLink('non-existent-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should verify valid magic link, create new user if needed, and issue JWT', async () => {
    const linkRes = await service.requestMagicLink('newuser@example.com');
    const token = linkRes.token!;

    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockUserRepo.create.mockResolvedValue({
      id: 'new-user-id',
      email: 'newuser@example.com',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await service.verifyMagicLink(token, 'guest-session-123');
    expect(result.user.email).toBe('newuser@example.com');
    expect(result.token).toBe('mock-jwt-token');
    expect(mockSessionClaimService.claimGuestSession).toHaveBeenCalledWith(
      'new-user-id',
      'guest-session-123',
    );
  });

  it('should prevent replay attacks by rejecting reused magic tokens', async () => {
    const linkRes = await service.requestMagicLink('reuse@example.com');
    const token = linkRes.token!;

    mockUserRepo.findByEmail.mockResolvedValue({
      id: 'u-1',
      email: 'reuse@example.com',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await service.verifyMagicLink(token);

    // Second attempt with same token
    await expect(service.verifyMagicLink(token)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject JWT verification if user has been deleted', async () => {
    mockJwtService.verify.mockReturnValue({ sub: 'deleted-user', email: 'del@example.com' });
    mockUserRepo.findById.mockResolvedValue(null);

    await expect(service.verifyJwt('some-valid-jwt')).rejects.toThrow(
      'User account no longer exists',
    );
  });
});
