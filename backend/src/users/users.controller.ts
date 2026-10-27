import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { SESSION_COOKIE } from '../auth/session-cookie';
import { TermsAcceptanceDto } from '../legal/dto/terms-acceptance.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiCookieAuth(SESSION_COOKIE)
@ApiUnauthorizedResponse({ description: 'Sin sesión válida' })
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil del usuario de la sesión' })
  @ApiOkResponse({ type: ProfileResponseDto })
  getMe(@CurrentAuth() auth: AuthContext): Promise<ProfileResponseDto> {
    return this.users.getProfile(auth.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualiza el nombre y el avatar' })
  @ApiOkResponse({ type: ProfileResponseDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos o campos no editables' })
  updateMe(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.users.updateProfile(auth.userId, dto);
  }

  @Post('me/terms')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Registra la aceptación de los términos y la política de privacidad vigentes',
    description:
      'Repetirlo no cambia la fecha original. Sirve también para quien se registró con Google y para cuando cambia la versión de los términos.',
  })
  @ApiOkResponse({ type: ProfileResponseDto })
  @ApiBadRequestResponse({ description: 'No se aceptó o la versión no está vigente' })
  acceptTerms(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: TermsAcceptanceDto,
  ): Promise<ProfileResponseDto> {
    return this.users.acceptTerms(auth.userId, dto);
  }
}