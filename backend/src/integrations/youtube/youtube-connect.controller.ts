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
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AuthContext } from '../../auth/auth-context';
import { CurrentAuth } from '../../auth/current-auth.decorator';
import { SESSION_COOKIE } from '../../auth/session-cookie';
import { safeErrorMessage } from '../../common/logging/redact';
import { FRONTEND_PATHS } from '../../frontend/frontend-origin';
import { FrontendRedirects } from '../../frontend/frontend-redirects';
import { oauthFailureCode } from '../../frontend/oauth-failure-code';
import { SocialAccountResponseDto } from '../../social-accounts/dto/social-account-response.dto';
import {
  YT_OAUTH_COOKIE,
  ytCookieOptions,
  ytCookieSetOptions,
} from './youtube-oauth-cookie';
import { YoutubeConnectService } from './youtube-connect.service';

@ApiTags('integrations')
@ApiCookieAuth(SESSION_COOKIE)
@ApiUnauthorizedResponse({ description: 'Sin sesión válida' })
@Controller('integrations/youtube')
export class YoutubeConnectController {
  private readonly logger = new Logger(YoutubeConnectController.name);

  constructor(
    private readonly youtube: YoutubeConnectService,
    private readonly config: ConfigService,
    private readonly frontend: FrontendRedirects,
  ) {}

  private get secureCookies(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }

  @Get('connect')
  @Redirect()
  @ApiOperation({ summary: 'Inicia la conexión de un canal de YouTube (redirige a Google)' })
  @ApiFoundResponse({ description: 'Redirección a la pantalla de consentimiento de Google' })
  @ApiServiceUnavailableResponse({ description: 'La conexión con YouTube no está configurada' })
  start(@Res({ passthrough: true }) res: Response): { url: string; statusCode: number } {
    const { url, cookieValue } = this.youtube.start();
    res.cookie(YT_OAUTH_COOKIE, cookieValue, ytCookieSetOptions(this.secureCookies));
    return { url, statusCode: 302 };
  }

  @Get('callback')
  @ApiOperation({
    summary: 'Destino de Google: valida la respuesta y conecta el canal',
    description:
      'Con FRONTEND_URL configurada redirige siempre al frontend: a `/cuentas?youtube=connected` si todo va bien o a `/cuentas?youtube=error&reason=<código>` si falla. Sin ella, responde la cuenta conectada en JSON y los fallos como error HTTP.',
  })
  @ApiOkResponse({
    type: SocialAccountResponseDto,
    description: 'Sin frontend configurado: la cuenta conectada',
  })
  @ApiFoundResponse({ description: 'Con frontend configurado: redirección al frontend' })
  @ApiBadRequestResponse({
    description: 'Solicitud inválida, permisos faltantes o cuenta sin canal; sin frontend configurado',
  })
  @ApiConflictResponse({
    description: 'El canal ya está conectado a otra cuenta; sin frontend configurado',
  })
  @ApiBadGatewayResponse({
    description: 'Falló la comunicación con Google o YouTube; sin frontend configurado',
  })
  @ApiServiceUnavailableResponse({ description: 'La conexión con YouTube no está configurada' })
  async callback(
    @CurrentAuth() auth: AuthContext,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // La cookie del flujo es de un solo uso: se borra pase lo que pase.
    const cookie: unknown = req.cookies?.[YT_OAUTH_COOKIE];
    res.clearCookie(YT_OAUTH_COOKIE, ytCookieOptions(this.secureCookies));

    try {
      const account = await this.youtube.finish(auth.userId, { code, state, error, cookie });
      const url = this.frontend.to(FRONTEND_PATHS.accounts, { youtube: 'connected' });
      if (url) res.redirect(302, url);
      else res.json(account);
    } catch (failure) {
      const url = this.frontend.to(FRONTEND_PATHS.accounts, {
        youtube: 'error',
        reason: oauthFailureCode(failure),
      });
      if (!url) throw failure; // sin frontend: error HTTP como hasta ahora
      if (!(failure instanceof HttpException)) {
        this.logger.warn(`Falló la conexión de YouTube: ${safeErrorMessage(failure)}`);
      }
      res.redirect(302, url);
    }
  }
}