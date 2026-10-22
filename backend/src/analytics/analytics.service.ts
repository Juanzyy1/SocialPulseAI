import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { pacificDate } from '../common/dates/pacific-date';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccountAnalyticsResponseDto,
  DailyPointDto,
  MetricValueDto,
  TotalValueDto,
} from './dto/account-analytics-response.dto';
import { PeriodQueryDto } from './dto/period-query.dto';
import { getMetricDefinition, metricsOf } from './metric-catalog';
import { aggregatePeriod, DailyValue, PeriodMetric } from './period-aggregation';
import { countDays, parsePeriodRequest, resolvePeriod, summarizeCoverage } from './period';

const NOT_FOUND = 'Cuenta no encontrada';
const NO_DATA_MESSAGE =
  'Todavía no hay métricas guardadas para esta cuenta; sincronízala con POST /social-accounts/{id}/sync';
const NO_DATA_IN_PERIOD_MESSAGE = 'No hay datos guardados en este periodo';

/** Fecha pura (AAAA-MM-DD) como la guarda y la lee la columna `date`. */
const toDbDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const toIsoDay = (date: Date): string => date.toISOString().slice(0, 10);

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccountAnalytics(
    userId: string,
    id: string,
    query: PeriodQueryDto,
  ): Promise<AccountAnalyticsResponseDto> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id, userId },
      select: { id: true, platform: true, displayName: true, status: true, lastSyncedAt: true },
    });
    // Mismo error si no existe o es de otro usuario: no se revela qué IDs existen.
    if (!account) throw new NotFoundException(NOT_FOUND);

    const today = pacificDate(new Date());
    const parsed = parsePeriodRequest(query, today);
    if (!parsed.ok) throw new BadRequestException(parsed.error);

    const latest = await this.prisma.accountDailyMetric.aggregate({
      where: { socialAccountId: id },
      _max: { metricDate: true },
    });
    const dataThrough = latest._max.metricDate ? toIsoDay(latest._max.metricDate) : null;
    const period = resolvePeriod(parsed.request, dataThrough);

    const base = {
      account: {
        id: account.id,
        platform: account.platform,
        displayName: account.displayName,
        status: account.status,
      },
      dataThrough,
      daysBehind: dataThrough === null ? null : Math.max(0, countDays(dataThrough, today) - 1),
      lastSyncedAt: account.lastSyncedAt,
      totals: await this.latestTotals(id, account.platform),
    };

    if (!period) {
      return { ...base, period: null, coverage: null, metrics: [], message: NO_DATA_MESSAGE };
    }

    const rows = await this.prisma.accountDailyMetric.findMany({
      where: {
        socialAccountId: id,
        metricDate: { gte: toDbDate(period.start), lte: toDbDate(period.end) },
      },
      select: { metricDate: true, metric: true, value: true },
      orderBy: { metricDate: 'asc' },
    });
    const daily: DailyValue[] = rows.map((row) => ({
      date: toIsoDay(row.metricDate),
      metric: row.metric,
      value: row.value,
    }));

    const coverage = summarizeCoverage(
      period.start,
      period.end,
      new Set(daily.map((row) => row.date)),
    );

    return {
      ...base,
      period,
      coverage,
      metrics: this.describeMetrics(account.platform, aggregatePeriod(account.platform, daily)),
      ...(query.daily ? { daily: this.dailySeries(daily) } : {}),
      message: coverage.daysWithData === 0 ? NO_DATA_IN_PERIOD_MESSAGE : null,
    };
  }

  /** Añade a cada métrica su tipo, unidad y advertencia, en el orden del catálogo. */
  private describeMetrics(platform: string, metrics: PeriodMetric[]): MetricValueDto[] {
    const order = metricsOf(platform).map((m) => m.code);
    return metrics
      .flatMap((metric) => {
        const definition = getMetricDefinition(platform, metric.metric);
        if (!definition || definition.kind === 'snapshot') return [];
        return [
          {
            metric: metric.metric,
            kind: definition.kind,
            unit: definition.unit,
            value: metric.value,
            daysWithData: metric.daysWithData,
            note: definition.note ?? null,
          },
        ];
      })
      .sort((a, b) => order.indexOf(a.metric) - order.indexOf(b.metric));
  }

  /** Último valor capturado de cada total puntual, con su fecha. No depende del periodo. */
  private async latestTotals(accountId: string, platform: string): Promise<TotalValueDto[]> {
    const snapshots = await this.prisma.accountTotalSnapshot.findMany({
      where: { socialAccountId: accountId },
      orderBy: [{ snapshotDate: 'desc' }, { metric: 'asc' }],
      distinct: ['metric'],
      select: { metric: true, value: true, snapshotDate: true },
    });
    const order = metricsOf(platform).map((m) => m.code);
    return snapshots
      .flatMap((snapshot) => {
        const definition = getMetricDefinition(platform, snapshot.metric);
        if (!definition || definition.kind !== 'snapshot') return [];
        return [
          {
            metric: snapshot.metric,
            unit: definition.unit,
            value: snapshot.value,
            capturedOn: toIsoDay(snapshot.snapshotDate),
            note: definition.note ?? null,
          },
        ];
      })
      .sort((a, b) => order.indexOf(a.metric) - order.indexOf(b.metric));
  }

  /** Serie diaria: una entrada por cada día CON dato, en orden. Los días ausentes no aparecen. */
  private dailySeries(daily: DailyValue[]): DailyPointDto[] {
    const byDate = new Map<string, Record<string, number>>();
    for (const row of daily) {
      const values = byDate.get(row.date) ?? {};
      values[row.metric] = row.value;
      byDate.set(row.date, values);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, values]) => ({ date, values }));
  }
}