import {
  Controller,
  Get,
  HttpException,
  Logger,
  Query,
  Redirect,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiFoundResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { safeErrorMessage } from '../common/logging/redact';
import { FRONTEND_PATHS } from '../frontend/frontend-origin';
import { FrontendRedirects } from '../frontend/frontend-redirects';
import { oauthFailureCode } from '../frontend/oauth-failure-code';
import { GoogleAuthService } from './google-auth.service';
import {
  OAUTH_COOKIE,
  oauthCookieOptions,
  oauthCookieSetOptions,
} from './oauth-flow';
import { Public } from './public.decorator';
import { SESSION_COOKIE, sessionCookieSetOptions } from './session-cookie';

@ApiTags('auth')
@Controller('auth/google')
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(
    private readonly googleAuth: GoogleAuthService,
    private readonly config: ConfigService,
    private readonly frontend: FrontendRedirects,
  ) {}

  private get secureCookies(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }

  @Public()
  @Get()
  @Redirect()
  @ApiOperation({ summary: 'Inicia el acceso con Google (redirige a Google)' })
  @ApiFoundResponse({ description: 'Redirección a la pantalla de Google' })
  @ApiServiceUnavailableResponse({ description: 'Google no está configurado' })
  start(@Res({ passthrough: true }) res: Response): { url: string; statusCode: number } {
    const { url, cookieValue } = this.googleAuth.start();
    res.cookie(OAUTH_COOKIE, cookieValue, oauthCookieSetOptions(this.secureCookies));
    return { url, statusCode: 302 };
  }

  @Public()
  @Get('callback')
  @ApiOperation({
    summary: 'Destino de Google: valida la respuesta y crea la sesión',
    description:
      'Con FRONTEND_URL configurada redirige siempre al frontend: a `/` si todo va bien o a `/login?error=<código>` si falla. Sin ella, redirige a `/api/v1/users/me` y los fallos responden como error HTTP.',
  })
  @ApiFoundResponse({ description: 'Redirección al frontend (o al perfil si no hay frontend)' })
  @ApiBadRequestResponse({ description: 'Solicitud inválida (state o cookie); sin frontend configurado' })
  @ApiUnauthorizedResponse({
    description: 'Google rechazó o no se pudo verificar la identidad; sin frontend configurado',
  })
  @ApiServiceUnavailableResponse({ description: 'Google no está configurado' })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // La cookie del flujo es de un solo uso: se borra pase lo que pase.
    const cookie: unknown = req.cookies?.[OAUTH_COOKIE];
    res.clearCookie(OAUTH_COOKIE, oauthCookieOptions(this.secureCookies));

    try {
      const { token } = await this.googleAuth.finish(
        { code, state, error, cookie },
        { userAgent: req.headers['user-agent'], ipAddress: req.ip },
      );
      res.cookie(SESSION_COOKIE, token, sessionCookieSetOptions(this.secureCookies));
    } catch (failure) {
      const url = this.frontend.to(FRONTEND_PATHS.login, { error: oauthFailureCode(failure) });
      if (!url) throw failure; // sin frontend: error HTTP como hasta ahora
      if (!(failure instanceof HttpException)) {
        this.logger.warn(`Falló el acceso con Google: ${safeErrorMessage(failure)}`);
      }
      res.redirect(302, url);
      return;
    }

    // Sin frontend configurado, vuelve al perfil como hasta ahora.
    res.redirect(302, this.frontend.to(FRONTEND_PATHS.home) ?? '/api/v1/users/me');
  }
}