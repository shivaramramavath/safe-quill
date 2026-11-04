import {
  Controller,
  Delete,
  Get,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AUTH_COOKIE_NAME, UserExportData } from '@safe-quill/shared';
import { SavedSessionService } from '../../application/services/saved-session.service';
import { JwtAuthGuard } from '../http/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../http/decorators/current-user.decorator';

@Controller('api/v1/account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly savedSessionService: SavedSessionService) {}

  @Get('export')
  async exportAccount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserExportData> {
    return this.savedSessionService.exportUserData(user.id);
  }

  @Delete()
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.savedSessionService.deleteAccount(user.id);

    // Clear auth cookie
    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return result;
  }
}
