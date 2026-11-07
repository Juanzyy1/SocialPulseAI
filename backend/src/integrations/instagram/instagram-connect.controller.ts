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
  IG_OAUTH_COOKIE,
  instagramCookieOptions,
  instagramCookieSetOptions,
} from './instagram-oauth-cookie';
import { InstagramConnectService } from './instagram-connect.service';

@ApiTags('integrations')
@ApiCookieAuth(SESSION_COOKIE)
@ApiUnauthorizedResponse({ description: 'Sin sesión válida' })
@Controller('integrations/instagram')
export class InstagramConnectController {
  private readonly logger = new Logger(InstagramConnectController.name);

  constructor(
    private readonly instagram: InstagramConnectService,
    private readonly config: ConfigService,
    private readonly frontend: FrontendRedirects,
  ) {}

  private get secureCookies(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }

  @Get('connect')
  @Redirect()
  @ApiOperation({ summary: 'Inicia la conexión de una cuenta profesional de Instagram' })
  @ApiFoundResponse({ description: 'Redirección a Instagram para autorizar el acceso' })
  @ApiServiceUnavailableResponse({ description: 'La conexión con Instagram no está configurada' })
  start(@Res({ passthrough: true }) res: Response): { url: string; statusCode: number } {
    const { url, cookieValue } = this.instagram.start();
    res.cookie(IG_OAUTH_COOKIE, cookieValue, instagramCookieSetOptions(this.secureCookies));
    return { url, statusCode: 302 };
  }

  @Get('callback')
  @ApiOperation({
    summary: 'Destino de Instagram: valida la respuesta y conecta la cuenta',
    description:
      'Destino de Instagram API with Unified Login. Al completar la autorización guarda el token cifrado y redirige a `/cuentas?instagram=connected` si FRONTEND_URL está configurada.',
  })
  @ApiOkResponse({
    type: [SocialAccountResponseDto],
    description: 'Cuentas de Instagram conectadas',
  })
  @ApiBadRequestResponse({ description: 'Solicitud inválida o autorización rechazada' })
  @ApiConflictResponse({ description: 'Esta cuenta ya está conectada a otro usuario' })
  @ApiBadGatewayResponse({ description: 'Falló la comunicación con Instagram' })
  @ApiServiceUnavailableResponse({ description: 'La conexión con Instagram no está configurada' })
  async callback(
    @CurrentAuth() auth: AuthContext,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const cookie: unknown = req.cookies?.[IG_OAUTH_COOKIE];
    res.clearCookie(IG_OAUTH_COOKIE, instagramCookieOptions(this.secureCookies));

    try {
      const account = await this.instagram.finish(auth.userId, { code, state, error, cookie });
      const url = this.frontend.to(FRONTEND_PATHS.accounts, { instagram: 'connected' });
      if (url) res.redirect(302, url);
      else res.json(account);
    } catch (failure) {
      const url = this.frontend.to(FRONTEND_PATHS.accounts, {
        instagram: 'error',
        reason: oauthFailureCode(failure, 'instagram'),
      });
      if (!url) throw failure;
      if (!(failure instanceof HttpException)) {
        this.logger.warn(`Falló la conexión de Instagram: ${safeErrorMessage(failure)}`);
      }
      res.redirect(302, url);
    }
  }
}
