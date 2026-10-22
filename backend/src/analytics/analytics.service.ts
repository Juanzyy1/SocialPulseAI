import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { pacificDate } from '../common/dates/pacific-date';
import { PrismaService } from '../prisma/prisma.service';
import { compareMetrics, previousPeriod } from './comparison';
import {
  AccountAnalyticsResponseDto,
  AnalyticsAccountDto,
  DailyPointDto,
  MetricValueDto,
  TotalValueDto,
} from './dto/account-analytics-response.dto';
import { ComparisonResponseDto } from './dto/compare-response.dto';
import { CompareQueryDto, PeriodParamsDto, PeriodQueryDto } from './dto/period-query.dto';
import { getMetricDefinition, metricsOf } from './metric-catalog';
import { aggregatePeriod, DailyValue, PeriodMetric } from './period-aggregation';
import {
  countDays,
  Coverage,
  parsePeriodRequest,
  PeriodRequest,
  resolvePeriod,
  ResolvedPeriod,
  summarizeCoverage,
} from './period';

const NOT_FOUND = 'Cuenta no encontrada';
const NO_DATA_MESSAGE =
  'Todavía no hay métricas guardadas para esta cuenta; sincronízala con POST /social-accounts/{id}/sync';
const NO_DATA_IN_PERIOD_MESSAGE = 'No hay datos guardados en este periodo';
const NO_PREVIOUS_DATA_MESSAGE =
  'No hay datos guardados en el periodo anterior; no se puede comparar';

/** Fecha pura (AAAA-MM-DD) como la guarda y la lee la columna `date`. */
const toDbDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const toIsoDay = (date: Date): string => date.toISOString().slice(0, 10);

interface AccountRow extends AnalyticsAccountDto {
  lastSyncedAt: Date | null;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccountAnalytics(
    userId: string,
    id: string,
    query: PeriodQueryDto,
  ): Promise<AccountAnalyticsResponseDto> {
    const account = await this.loadAccount(userId, id);
    const today = pacificDate(new Date());
    const request = this.parseRequest(query, today);

    const dataThrough = await this.dataThrough(id);
    const period = resolvePeriod(request, dataThrough);

    const base = {
      account: this.publicAccount(account),
      dataThrough,
      daysBehind: this.daysBehind(dataThrough, today),
      lastSyncedAt: account.lastSyncedAt,
      totals: await this.latestTotals(id, account.platform),
    };

    if (!period) {
      return { ...base, period: null, coverage: null, metrics: [], message: NO_DATA_MESSAGE };
    }

    const data = await this.periodData(id, account.platform, period);
    return {
      ...base,
      period,
      coverage: data.coverage,
      metrics: data.metrics,
      ...(query.daily ? { daily: this.dailySeries(data.daily) } : {}),
      message: data.coverage.daysWithData === 0 ? NO_DATA_IN_PERIOD_MESSAGE : null,
    };
  }

  /**
   * Compara un periodo con el inmediatamente anterior (misma longitud). Nunca compara en
   * silencio: cada métrica indica si es comparable y, si no, por qué.
   */
  async compare(userId: string, query: CompareQueryDto): Promise<ComparisonResponseDto> {
    const account = await this.loadAccount(userId, query.accountId);
    const today = pacificDate(new Date());
    const request = this.parseRequest(query, today);

    const dataThrough = await this.dataThrough(account.id);
    const base = {
      account: this.publicAccount(account),
      dataThrough,
      daysBehind: this.daysBehind(dataThrough, today),
    };

    const currentPeriod = resolvePeriod(request, dataThrough);
    if (!currentPeriod) {
      return {
        ...base,
        current: null,
        previous: null,
        comparable: false,
        message: NO_DATA_MESSAGE,
        metrics: [],
      };
    }

    const previousRange = previousPeriod(currentPeriod);
    const [current, previous] = await Promise.all([
      this.periodData(account.id, account.platform, currentPeriod),
      this.periodData(account.id, account.platform, previousRange),
    ]);

    const metrics = compareMetrics(current.metrics, previous.metrics);
    return {
      ...base,
      current: { period: currentPeriod, coverage: current.coverage },
      previous: { period: previousRange, coverage: previous.coverage },
      comparable: metrics.length > 0 && metrics.every((metric) => metric.comparable),
      message: this.comparisonMessage(current.coverage, previous.coverage),
      metrics,
    };
  }

  private comparisonMessage(current: Coverage, previous: Coverage): string | null {
    if (current.daysWithData === 0) return NO_DATA_IN_PERIOD_MESSAGE;
    if (previous.daysWithData === 0) return NO_PREVIOUS_DATA_MESSAGE;
    if (current.daysWithData !== previous.daysWithData) {
      return `Los periodos tienen distinta cobertura (${current.daysWithData} y ${previous.daysWithData} días con dato): solo se comparan las métricas sumables que cubren los mismos días`;
    }
    return null;
  }

  private async loadAccount(userId: string, id: string): Promise<AccountRow> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id, userId },
      select: { id: true, platform: true, displayName: true, status: true, lastSyncedAt: true },
    });
    // Mismo error si no existe o es de otro usuario: no se revela qué IDs existen.
    if (!account) throw new NotFoundException(NOT_FOUND);
    return account;
  }

  private publicAccount(account: AccountRow): AnalyticsAccountDto {
    return {
      id: account.id,
      platform: account.platform,
      displayName: account.displayName,
      status: account.status,
    };
  }

  private parseRequest(query: PeriodParamsDto, today: string): PeriodRequest {
    const parsed = parsePeriodRequest(query, today);
    if (!parsed.ok) throw new BadRequestException(parsed.error);
    return parsed.request;
  }

  private async dataThrough(accountId: string): Promise<string | null> {
    const latest = await this.prisma.accountDailyMetric.aggregate({
      where: { socialAccountId: accountId },
      _max: { metricDate: true },
    });
    return latest._max.metricDate ? toIsoDay(latest._max.metricDate) : null;
  }

  private daysBehind(dataThrough: string | null, today: string): number | null {
    return dataThrough === null ? null : Math.max(0, countDays(dataThrough, today) - 1);
  }

  /** Valores diarios, cobertura y métricas agregadas de un periodo. */
  private async periodData(accountId: string, platform: string, period: ResolvedPeriod) {
    const rows = await this.prisma.accountDailyMetric.findMany({
      where: {
        socialAccountId: accountId,
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

    return {
      daily,
      coverage: summarizeCoverage(period.start, period.end, new Set(daily.map((r) => r.date))),
      metrics: this.describeMetrics(platform, aggregatePeriod(platform, daily)),
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