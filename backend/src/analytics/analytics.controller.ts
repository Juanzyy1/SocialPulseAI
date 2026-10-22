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
import { AnalyticsService } from './analytics.service';
import { AccountAnalyticsResponseDto } from './dto/account-analytics-response.dto';
import { ComparisonResponseDto } from './dto/compare-response.dto';
import { CompareQueryDto, PeriodQueryDto } from './dto/period-query.dto';

@ApiTags('analytics')
@ApiCookieAuth(SESSION_COOKIE)
@ApiUnauthorizedResponse({ description: 'Sin sesión válida' })
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('accounts/:id')
  @ApiOperation({
    summary: 'Estadísticas de una cuenta para un periodo',
    description:
      'Los periodos 7d/30d/90d terminan en el último día con dato de la cuenta, no en hoy. `coverage` indica cuántos días del rango tienen dato y qué tramos faltan: un día ausente no es un cero. Los totales (suscriptores, vistas totales, videos) son los más recientes capturados y no dependen del periodo.',
  })
  @ApiOkResponse({ type: AccountAnalyticsResponseDto })
  @ApiBadRequestResponse({ description: 'ID o parámetros de periodo inválidos' })
  @ApiNotFoundResponse({ description: 'No existe o no pertenece al usuario' })
  account(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PeriodQueryDto,
  ): Promise<AccountAnalyticsResponseDto> {
    return this.analytics.getAccountAnalytics(auth.userId, id, query);
  }

  @Get('compare')
  @ApiOperation({
    summary: 'Compara un periodo con el inmediatamente anterior (misma longitud)',
    description:
      'Nunca compara en silencio. Las métricas sumables solo se comparan si ambos periodos tienen el mismo número de días con dato; la duración media, si ambos periodos tienen valor. En caso contrario `comparable` es false y `reason` explica por qué. `changePercent` es null cuando el valor anterior es 0. Los totales puntuales no se comparan aquí.',
  })
  @ApiOkResponse({ type: ComparisonResponseDto })
  @ApiBadRequestResponse({ description: 'accountId o parámetros de periodo inválidos' })
  @ApiNotFoundResponse({ description: 'No existe o no pertenece al usuario' })
  compare(
    @CurrentAuth() auth: AuthContext,
    @Query() query: CompareQueryDto,
  ): Promise<ComparisonResponseDto> {
    return this.analytics.compare(auth.userId, query);
  }
}