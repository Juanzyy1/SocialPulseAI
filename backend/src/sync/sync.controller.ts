import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { SESSION_COOKIE } from '../auth/session-cookie';
import { SyncRunResponseDto } from './dto/sync-run-response.dto';
import { SyncStatusResponseDto } from './dto/sync-status-response.dto';
import { SyncService } from './sync.service';

@ApiTags('sync')
@ApiCookieAuth(SESSION_COOKIE)
@ApiUnauthorizedResponse({ description: 'Sin sesión válida' })
@Controller('social-accounts')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post(':id/sync')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sincroniza las métricas de la cuenta con la plataforma',
    description:
      'Responde 200 con el resultado de la ejecución; revisa `status` (SUCCEEDED o FAILED) y `errorMessage`. Los errores HTTP se reservan para lo que impide empezar.',
  })
  @ApiOkResponse({ type: SyncRunResponseDto })
  @ApiBadRequestResponse({ description: 'ID inválido o plataforma no compatible' })
  @ApiNotFoundResponse({ description: 'No existe o no pertenece al usuario' })
  @ApiConflictResponse({ description: 'Ya hay una sincronización en curso, o hay que reconectar la cuenta' })
  @ApiTooManyRequestsResponse({ description: 'Se sincronizó hace menos de un minuto' })
  run(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SyncRunResponseDto> {
    return this.sync.sync(auth.userId, id);
  }

  @Get(':id/sync-status')
  @ApiOperation({ summary: 'Estado de la última sincronización de la cuenta' })
  @ApiOkResponse({ type: SyncStatusResponseDto })
  @ApiBadRequestResponse({ description: 'El ID no es un UUID válido' })
  @ApiNotFoundResponse({ description: 'No existe o no pertenece al usuario' })
  status(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SyncStatusResponseDto> {
    return this.sync.getStatus(auth.userId, id);
  }
}