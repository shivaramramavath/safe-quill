import {
  Body,
  Controller,
  Delete,
  Get,
  Put,
  Req,
  Res,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { SessionResponse, GUEST_COOKIE_NAME, GUEST_SESSION_TTL_SECONDS } from '@safe-quill/shared';
import { SessionService } from '../../application/services/session.service';
import { UpdateDraftDto } from '../../application/dtos/update-draft.dto';
import {
  AuthenticatedGuestRequest,
  GuestSessionInterceptor,
} from '../interceptors/guest-session.interceptor';

@Controller('api/v1/session')
@UseInterceptors(GuestSessionInterceptor)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  async getSession(
    @Req() req: AuthenticatedGuestRequest,
  ): Promise<SessionResponse> {
    const { session } = await this.sessionService.getOrCreateSession(
      req.guestSessionId,
    );
    return this.sessionService.toResponse(session);
  }

  @Put('draft')
  async updateDraft(
    @Req() req: AuthenticatedGuestRequest,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateDraftDto,
  ): Promise<SessionResponse> {
    return this.sessionService.updateDraft(req.guestSessionId!, dto);
  }

  @Delete()
  async clearSession(
    @Req() req: AuthenticatedGuestRequest,
  ): Promise<SessionResponse> {
    return this.sessionService.clearSession(req.guestSessionId!);
  }

  @Delete('full')
  async purgeSession(
    @Req() req: AuthenticatedGuestRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: boolean }> {
    if (req.guestSessionId) {
      await this.sessionService.deleteSession(req.guestSessionId);
    }
    res.clearCookie(GUEST_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
    return { success: true };
  }
}
