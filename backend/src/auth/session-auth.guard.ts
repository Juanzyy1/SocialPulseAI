import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from './auth-context';
import { IS_PUBLIC_KEY } from './public.decorator';
import { SESSION_COOKIE } from './session-cookie';
import { SessionsService } from './sessions.service';

/** Guard global: sin sesión válida, 401, salvo en endpoints marcados @Public(). */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token: unknown = request.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string') throw new UnauthorizedException();

    const session = await this.sessions.validate(token);
    if (!session) throw new UnauthorizedException();

    request.auth = { ...session, token };
    return true;
  }
}