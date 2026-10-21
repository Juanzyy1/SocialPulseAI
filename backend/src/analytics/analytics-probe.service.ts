import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { safeErrorMessage } from '../common/logging/redact';
import { addDays, PACIFIC_TIME_ZONE, pacificDate } from '../common/dates/pacific-date';
import {
  ChannelStatistics,
  RawReport,
  YoutubeAnalyticsClient,
} from '../integrations/youtube/youtube-analytics.client';
import { YoutubeTokenService } from '../integrations/youtube/youtube-token.service';
import { PrismaService } from '../prisma/prisma.service';
import { Cell, extractApiError, parseReportTable, summarizeDailyTable } from './report-parser';

/** Valor inyectable: false en producción. Las pruebas pueden sustituirlo. */
export const ANALYTICS_PROBE_ENABLED = Symbol('ANALYTICS_PROBE_ENABLED');

/** Métricas candidatas a probar. La API real decide cuáles acepta el canal. */
export const CANDIDATE_METRICS = [
  'views',
  'engagedViews',
  'estimatedMinutesWatched',
  'averageViewDuration',
  'averageViewPercentage',
  'likes',
  'dislikes',
  'comments',
  'shares',
  'subscribersGained',
  'subscribersLost',
] as const;

export interface MetricProbe {
  statusCode: number;
  rowCount?: number;
  firstDate?: string | null;
  lastDate?: string | null;
  zeroValueRows?: number | null;
  error?: string;
}

export interface ProbeResult {
  requestedRange: { startDate: string; endDate: string; days: number; timeZone: string };
  serverNowUtc: string;
  combined: { statusCode: number; columns?: string[]; rows?: Cell[][]; error?: string };
  perMetric: Record<string, MetricProbe>;
  channelStatistics: ChannelStatistics | null;
}

/**
 * TEMPORAL: sondeo de exploración para decidir el modelo de datos de la Fase 5.
 * No guarda nada. Se elimina cuando llegue la sincronización real (5.3).
 */
@Injectable()
export class AnalyticsProbeService {
  private readonly logger = new Logger(AnalyticsProbeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: YoutubeTokenService,
    private readonly analytics: YoutubeAnalyticsClient,
    @Inject(ANALYTICS_PROBE_ENABLED) private readonly enabled: boolean,
  ) {}

  async run(userId: string, id: string, days: number): Promise<ProbeResult> {
    // En producción el endpoint finge no existir.
    if (!this.enabled) throw new NotFoundException();
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      throw new BadRequestException('days debe ser un entero entre 1 y 90');
    }

    const account = await this.prisma.socialAccount.findFirst({
      where: { id, userId },
      select: { platform: true },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');
    if (account.platform !== 'YOUTUBE') {
      throw new BadRequestException('Esta plataforma todavía no es compatible');
    }

    const accessToken = await this.tokens.getAccessToken(id);
    const endDate = pacificDate(new Date());
    const startDate = addDays(endDate, -(days - 1));

    const combined = this.describeCombined(
      await this.analytics.queryReport(accessToken, {
        startDate,
        endDate,
        metrics: CANDIDATE_METRICS,
        dimensions: ['day'],
        sort: 'day',
      }),
    );

    // Una consulta por métrica, en secuencia: así sabemos cuál falla y por qué.
    const perMetric: Record<string, MetricProbe> = {};
    for (const metric of CANDIDATE_METRICS) {
      perMetric[metric] = this.describeMetric(
        await this.analytics.queryReport(accessToken, {
          startDate,
          endDate,
          metrics: [metric],
          dimensions: ['day'],
          sort: 'day',
        }),
        metric,
      );
    }

    let channelStatistics: ChannelStatistics | null = null;
    try {
      channelStatistics = await this.analytics.fetchChannelStatistics(accessToken);
    } catch (error) {
      this.logger.warn(`Falló la consulta de estadísticas del canal: ${safeErrorMessage(error)}`);
    }

    return {
      requestedRange: { startDate, endDate, days, timeZone: PACIFIC_TIME_ZONE },
      serverNowUtc: new Date().toISOString(),
      combined,
      perMetric,
      channelStatistics,
    };
  }

  private describeCombined(report: RawReport): ProbeResult['combined'] {
    if (report.statusCode !== 200) {
      return { statusCode: report.statusCode, error: extractApiError(report.body) };
    }
    const table = parseReportTable(report.body);
    if (!table) {
      return { statusCode: report.statusCode, error: 'Respuesta con formato inesperado' };
    }
    return { statusCode: report.statusCode, columns: table.columns, rows: table.rows };
  }

  private describeMetric(report: RawReport, metric: string): MetricProbe {
    if (report.statusCode !== 200) {
      return { statusCode: report.statusCode, error: extractApiError(report.body) };
    }
    const table = parseReportTable(report.body);
    if (!table) {
      return { statusCode: report.statusCode, error: 'Respuesta con formato inesperado' };
    }
    return { statusCode: report.statusCode, ...summarizeDailyTable(table, metric) };
  }
}