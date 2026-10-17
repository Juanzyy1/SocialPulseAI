import { Controller, Get, Query, Redirect, Req, Res } from '@nestjs/common';
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
  constructor(
    private readonly googleAuth: GoogleAuthService,
    private readonly config: ConfigService,
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
  // Hasta que exista un frontend, el usuario vuelve a su perfil.
  @Redirect('/api/v1/users/me', 302)
  @ApiOperation({ summary: 'Destino de Google: valida la respuesta y crea la sesión' })
  @ApiFoundResponse({ description: 'Sesión creada; redirige al perfil' })
  @ApiBadRequestResponse({ description: 'Solicitud inválida (state o cookie)' })
  @ApiUnauthorizedResponse({ description: 'Google rechazó o no se pudo verificar la identidad' })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    // La cookie del flujo es de un solo uso: se borra pase lo que pase.
    const cookie: unknown = req.cookies?.[OAUTH_COOKIE];
    res.clearCookie(OAUTH_COOKIE, oauthCookieOptions(this.secureCookies));

    const { token } = await this.googleAuth.finish(
      { code, state, error, cookie },
      { userAgent: req.headers['user-agent'], ipAddress: req.ip },
    );
    res.cookie(SESSION_COOKIE, token, sessionCookieSetOptions(this.secureCookies));
  }
}