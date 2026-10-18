import { Controller, Delete, Get, Param, ParseUUIDPipe } from '@nestjs/common';
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