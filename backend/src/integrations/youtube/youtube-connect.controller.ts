import { Controller, Get, Query, Redirect, Req, Res } from '@nestjs/common';
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
  constructor(
    private readonly youtube: YoutubeConnectService,
    private readonly config: ConfigService,
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
  @ApiOperation({ summary: 'Destino de Google: valida la respuesta y conecta el canal' })
  @ApiOkResponse({ type: SocialAccountResponseDto })
  @ApiBadRequestResponse({ description: 'Solicitud inválida, permisos faltantes o cuenta sin canal' })
  @ApiConflictResponse({ description: 'El canal ya está conectado a otra cuenta' })
  @ApiBadGatewayResponse({ description: 'Falló la comunicación con Google o YouTube' })
  @ApiServiceUnavailableResponse({ description: 'La conexión con YouTube no está configurada' })
  async callback(
    @CurrentAuth() auth: AuthContext,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SocialAccountResponseDto> {
    // La cookie del flujo es de un solo uso: se borra pase lo que pase.
    const cookie: unknown = req.cookies?.[YT_OAUTH_COOKIE];
    res.clearCookie(YT_OAUTH_COOKIE, ytCookieOptions(this.secureCookies));

    return this.youtube.finish(auth.userId, { code, state, error, cookie });
  }
}