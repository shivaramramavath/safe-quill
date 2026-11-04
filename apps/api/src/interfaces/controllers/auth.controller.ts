import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  AUTH_COOKIE_NAME,
  GUEST_COOKIE_NAME,
  AuthResponse,
} from '@safe-quill/shared';
import { AuthService } from '../../application/services/auth.service';
import {
  GoogleAuthDto,
  MagicLinkDto,
  VerifyMagicLinkDto,
} from '../../application/dtos/auth.dto';
import { JwtAuthGuard } from '../http/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../http/decorators/current-user.decorator';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('magic-link')
  async requestMagicLink(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: MagicLinkDto,
  ) {
    const result = await this.authService.requestMagicLink(dto.email, dto.baseUrl);
    return {
      success: result.success,
      message: 'If this email is valid, a magic sign-in link has been sent.',
      token: result.token, // Present only in non-production for testing
    };
  }

  @Post('verify')
  async verifyMagicLink(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: VerifyMagicLinkDto,
  ): Promise<AuthResponse> {
    const guestSessionId = req.cookies?.[GUEST_COOKIE_NAME];
    const { user, token, claimedCount } = await this.authService.verifyMagicLink(
      dto.token,
      guestSessionId,
    );

    // Set secure auth cookie
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      user,
      claimedSessionCount: claimedCount,
      message:
        claimedCount > 0
          ? 'Successfully authenticated and claimed guest draft into your account.'
          : 'Successfully authenticated.',
    };
  }

  @Post('google')
  async loginWithGoogle(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: GoogleAuthDto,
  ): Promise<AuthResponse> {
    const guestSessionId = req.cookies?.[GUEST_COOKIE_NAME];
    const { user, token, claimedCount } = await this.authService.loginWithGoogleMock(
      dto.email,
      dto.googleId,
      guestSessionId,
    );

    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      user,
      claimedSessionCount: claimedCount,
      message:
        claimedCount > 0
          ? 'Google login successful. Guest draft claimed to your account.'
          : 'Google login successful.',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return { success: true, message: 'Logged out successfully' };
  }
}
