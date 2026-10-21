import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
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
import { AnalyticsProbeService, ProbeResult } from './analytics-probe.service';
import { ProbeQueryDto } from './dto/probe-query.dto';

@ApiTags('analytics (temporal)')
@ApiCookieAuth(SESSION_COOKIE)
@ApiUnauthorizedResponse({ description: 'Sin sesión válida' })
@Controller('analytics/probe')
export class AnalyticsProbeController {
  constructor(private readonly probe: AnalyticsProbeService) {}

  @Get(':id')
  @ApiOperation({
    summary:
      'TEMPORAL (solo desarrollo): sondeo crudo de YouTube Analytics para una cuenta propia',
  })
  @ApiOkResponse({
    description: 'Resultado crudo del sondeo',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiBadRequestResponse({ description: 'Parámetros inválidos' })
  @ApiNotFoundResponse({ description: 'No existe, no es del usuario, o estamos en producción' })
  run(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ProbeQueryDto,
  ): Promise<ProbeResult> {
    return this.probe.run(auth.userId, id, query.days ?? 30);
  }
}