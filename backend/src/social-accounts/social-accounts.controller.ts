import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { SESSION_COOKIE } from '../auth/session-cookie';
import { ConnectionCheckResponseDto } from './dto/connection-check-response.dto';
import { DisconnectResponseDto } from './dto/disconnect-response.dto';
import { SocialAccountResponseDto } from './dto/social-account-response.dto';
import { SocialAccountsService } from './social-accounts.service';

@ApiTags('social-accounts')
@ApiCookieAuth(SESSION_COOKIE)
@ApiUnauthorizedResponse({ description: 'Sin sesión válida' })
@Controller('social-accounts')
export class SocialAccountsController {
  constructor(private readonly accounts: SocialAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las cuentas sociales del usuario' })
  @ApiOkResponse({ type: SocialAccountResponseDto, isArray: true })
  list(@CurrentAuth() auth: AuthContext): Promise<SocialAccountResponseDto[]> {
    return this.accounts.list(auth.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una cuenta social propia' })
  @ApiOkResponse({ type: SocialAccountResponseDto })
  @ApiBadRequestResponse({ description: 'El ID no es un UUID válido' })
  @ApiNotFoundResponse({ description: 'No existe o no pertenece al usuario' })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SocialAccountResponseDto> {
    return this.accounts.get(auth.userId, id);
  }

  @Post(':id/check')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Comprueba que el acceso a YouTube sigue funcionando (renueva el token si hace falta)',
  })
  @ApiOkResponse({ type: ConnectionCheckResponseDto })
  @ApiBadRequestResponse({ description: 'ID inválido o plataforma no compatible' })
  @ApiNotFoundResponse({ description: 'No existe o no pertenece al usuario' })
  check(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConnectionCheckResponseDto> {
    return this.accounts.checkConnection(auth.userId, id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Desconecta la cuenta: revoca el acceso en Google (si es posible) y borra sus credenciales',
  })
  @ApiOkResponse({ type: DisconnectResponseDto })
  @ApiBadRequestResponse({ description: 'El ID no es un UUID válido' })
  @ApiNotFoundResponse({ description: 'No existe o no pertenece al usuario' })
  disconnect(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DisconnectResponseDto> {
    return this.accounts.disconnect(auth.userId, id);
  }
}