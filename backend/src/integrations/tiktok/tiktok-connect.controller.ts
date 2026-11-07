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
  TIKTOK_OAUTH_COOKIE,
  tiktokCookieOptions,
  tiktokCookieSetOptions,
} from './tiktok-oauth-cookie';
import { TikTokConnectService } from './tiktok-connect.service';

@ApiTags('integrations')
@ApiCookieAuth(SESSION_COOKIE)
@ApiUnauthorizedResponse({ description: 'Sin sesión válida' })
@Controller('integrations/tiktok')
export class TikTokConnectController {
  private readonly logger = new Logger(TikTokConnectController.name);

  constructor(
    private readonly tiktok: TikTokConnectService,
    private readonly config: ConfigService,
    private readonly frontend: FrontendRedirects,
  ) {}

  private get secureCookies(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }

  @Get('connect')
  @Redirect()
  @ApiOperation({ summary: 'Inicia la conexión de una cuenta de TikTok' })
  @ApiFoundResponse({ description: 'Redirección a Login Kit de TikTok' })
  @ApiServiceUnavailableResponse({ description: 'La conexión con TikTok no está configurada' })
  start(@Res({ passthrough: true }) res: Response): { url: string; statusCode: number } {
    const { url, cookieValue } = this.tiktok.start();
    res.cookie(TIKTOK_OAUTH_COOKIE, cookieValue, tiktokCookieSetOptions(this.secureCookies));
    return { url, statusCode: 302 };
  }

  @Get('callback')
  @ApiOperation({ summary: 'Valida la autorización de TikTok y conecta la cuenta' })
  @ApiOkResponse({ type: SocialAccountResponseDto })
  @ApiFoundResponse({ description: 'Redirección a la página de cuentas' })
  @ApiBadRequestResponse({ description: 'Solicitud inválida o autorización rechazada' })
  @ApiConflictResponse({ description: 'La cuenta ya está conectada a otro usuario' })
  @ApiBadGatewayResponse({ description: 'Falló la comunicación con TikTok' })
  @ApiServiceUnavailableResponse({ description: 'La conexión con TikTok no está configurada' })
  async callback(
    @CurrentAuth() auth: AuthContext,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const cookie: unknown = req.cookies?.[TIKTOK_OAUTH_COOKIE];
    res.clearCookie(TIKTOK_OAUTH_COOKIE, tiktokCookieOptions(this.secureCookies));
    try {
      const account = await this.tiktok.finish(auth.userId, { code, state, error, cookie });
      const url = this.frontend.to(FRONTEND_PATHS.accounts, { tiktok: 'connected' });
      if (url) res.redirect(302, url);
      else res.json(account);
    } catch (failure) {
      const url = this.frontend.to(FRONTEND_PATHS.accounts, {
        tiktok: 'error',
        reason: oauthFailureCode(failure, 'tiktok'),
      });
      if (!url) throw failure;
      if (!(failure instanceof HttpException)) {
        this.logger.warn(`Falló la conexión de TikTok: ${safeErrorMessage(failure)}`);
      }
      res.redirect(302, url);
    }
  }
}
