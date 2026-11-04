import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { UserProfile } from '@safe-quill/shared';
import {
  USER_REPOSITORY_PORT,
  UserRepositoryPort,
} from '../../domain/ports/user-repository.port';
import {
  MAILER_PORT,
  MailerPort,
} from '../../domain/ports/mailer.port';
import { SessionClaimService } from './session-claim.service';

interface MagicTokenRecord {
  email: string;
  expiresAt: number;
  used: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly tokenStore = new Map<string, MagicTokenRecord>();

  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepo: UserRepositoryPort,
    @Inject(MAILER_PORT)
    private readonly mailer: MailerPort,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly sessionClaimService: SessionClaimService,
  ) {}

  async requestMagicLink(email: string, baseUrl?: string): Promise<{ success: boolean; token?: string }> {
    const normalized = email.toLowerCase().trim();
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    this.tokenStore.set(token, {
      email: normalized,
      expiresAt,
      used: false,
    });

    const webUrl =
      baseUrl ||
      this.config.get<string>('WEB_BASE_URL') ||
      'http://localhost:3000';
    const magicUrl = `${webUrl}/auth/verify?token=${token}`;

    const sent = await this.mailer.sendMagicLink(normalized, magicUrl);
    this.logger.log(`Magic link requested for email. Sent: ${sent}`);

    // In non-production/test environments, return token in response for testing convenience
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    return {
      success: sent,
      token: isProd ? undefined : token,
    };
  }

  async verifyMagicLink(
    token: string,
    guestSessionId?: string,
  ): Promise<{ user: UserProfile; token: string; claimedCount: number }> {
    const record = this.tokenStore.get(token);
    if (!record) {
      throw new UnauthorizedException('Invalid or expired login link');
    }

    if (record.used) {
      throw new UnauthorizedException('This login link has already been used');
    }

    if (Date.now() > record.expiresAt) {
      this.tokenStore.delete(token);
      throw new UnauthorizedException('Login link has expired');
    }

    // Mark as used
    record.used = true;
    this.tokenStore.delete(token);

    // Find or create user
    let user = await this.userRepo.findByEmail(record.email);
    if (!user) {
      user = await this.userRepo.create(record.email);
    }

    // Sign JWT
    const jwtToken = this.jwtService.sign(
      { sub: user.id, email: user.email },
      {
        secret: this.config.get<string>('JWT_SECRET') || 'safe-quill-jwt-dev-secret-super-secure',
        expiresIn: '7d',
      },
    );

    // Claim guest session if exists
    let claimedCount = 0;
    if (guestSessionId) {
      const claimResult = await this.sessionClaimService.claimGuestSession(
        user.id,
        guestSessionId,
      );
      if (claimResult.claimed) {
        claimedCount = 1;
      }
    }

    return { user, token: jwtToken, claimedCount };
  }

  async loginWithGoogleMock(
    email: string,
    googleId: string,
    guestSessionId?: string,
  ): Promise<{ user: UserProfile; token: string; claimedCount: number }> {
    const normalized = email.toLowerCase().trim();
    let user = await this.userRepo.findByEmail(normalized);
    if (!user) {
      user = await this.userRepo.create(normalized, googleId);
    }

    const jwtToken = this.jwtService.sign(
      { sub: user.id, email: user.email },
      {
        secret: this.config.get<string>('JWT_SECRET') || 'safe-quill-jwt-dev-secret-super-secure',
        expiresIn: '7d',
      },
    );

    let claimedCount = 0;
    if (guestSessionId) {
      const claimResult = await this.sessionClaimService.claimGuestSession(
        user.id,
        guestSessionId,
      );
      if (claimResult.claimed) {
        claimedCount = 1;
      }
    }

    return { user, token: jwtToken, claimedCount };
  }

  async verifyJwt(token: string): Promise<{ userId: string; email: string }> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_SECRET') || 'safe-quill-jwt-dev-secret-super-secure',
      });
      const user = await this.userRepo.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User account no longer exists');
      }
      return { userId: payload.sub, email: payload.email };
    } catch (e: any) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
