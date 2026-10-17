import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTooManyRequestsResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AuthContext } from './auth-context';
import { AuthService } from './auth.service';
import { CurrentAuth } from './current-auth.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { Public } from './public.decorator';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionCookieSetOptions,
} from './session-cookie';
import { SessionsService } from './sessions.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    private readonly config: ConfigService,
  ) {}

  private get secureCookies(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registro con correo y contraseña' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiConflictResponse({ description: 'El correo ya está registrado' })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  @ApiTooManyRequestsResponse({ description: 'Demasiados registros desde esta IP' })
  register(@Body() dto: RegisterDto, @Req() req: Request): Promise<UserResponseDto> {
    return this.auth.register(dto, req.ip);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inicia sesión y fija la cookie de sesión' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas' })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  @ApiTooManyRequestsResponse({ description: 'Demasiados intentos fallidos' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserResponseDto> {
    const { user, token } = await this.auth.login(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    res.cookie(SESSION_COOKIE, token, sessionCookieSetOptions(this.secureCookies));
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiOperation({ summary: 'Cierra la sesión actual' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Sin sesión válida' })
  async logout(
    @CurrentAuth() auth: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessions.revoke(auth.token);
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.secureCookies));
  }

  @Post('logout-all')
  @HttpCode(204)
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiOperation({ summary: 'Cierra todas las sesiones del usuario' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Sin sesión válida' })
  async logoutAll(
    @CurrentAuth() auth: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessions.revokeAllForUser(auth.userId);
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.secureCookies));
  }
}