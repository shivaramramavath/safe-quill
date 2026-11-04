import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Response, Request } from 'express';
import { GUEST_COOKIE_NAME, GUEST_SESSION_TTL_SECONDS } from '@safe-quill/shared';
import { SessionService } from '../../application/services/session.service';

export interface AuthenticatedGuestRequest extends Request {
  guestSessionId?: string;
}

@Injectable()
export class GuestSessionInterceptor implements NestInterceptor {
  constructor(private readonly sessionService: SessionService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const http = context.switchToHttp();
    const req = http.getRequest<AuthenticatedGuestRequest>();
    const res = http.getResponse<Response>();

    const cookieSessionId = req.cookies?.[GUEST_COOKIE_NAME];
    const { session, isNew } = await this.sessionService.getOrCreateSession(cookieSessionId);

    req.guestSessionId = session.sessionId;

    if (isNew || !cookieSessionId) {
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie(GUEST_COOKIE_NAME, session.sessionId, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: GUEST_SESSION_TTL_SECONDS * 1000,
      });
    }

    return next.handle();
  }
}
