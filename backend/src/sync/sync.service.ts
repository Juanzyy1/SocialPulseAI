import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { dailyMetricCodes } from '../analytics/metric-catalog';
import { extractApiError, parseReportTable } from '../analytics/report-parser';
import { pacificDate } from '../common/dates/pacific-date';
import { redactSecrets, safeErrorMessage } from '../common/logging/redact';
import { YoutubeAnalyticsClient } from '../integrations/youtube/youtube-analytics.client';
import { YoutubeTokenService } from '../integrations/youtube/youtube-token.service';
import { PrismaService } from '../prisma/prisma.service';
import { SyncRunResponseDto } from './dto/sync-run-response.dto';
import { SyncStatusResponseDto } from './dto/sync-status-response.dto';
import { planSyncRange, SyncRange } from './sync-range';
import {
  MetricRow,
  SnapshotRow,
  statsToSnapshots,
  SyncDataError,
  tableToMetricRows,
} from './youtube-sync.mapper';

const NOT_FOUND = 'Cuenta no encontrada';
const RECONNECT_MESSAGE =
  'El acceso a YouTube fue revocado o caducó; vuelve a conectar la cuenta';
const RUNNING_MESSAGE = 'Ya hay una sincronización en curso para esta cuenta';
const COOLDOWN_MESSAGE = 'Espera un minuto antes de sincronizar de nuevo';

const COOLDOWN_MS = 60_000; // mínimo entre dos sincronizaciones de la misma cuenta
const STALE_RUN_MS = 5 * 60_000; // una ejecución "en curso" más vieja se da por interrumpida
const MAX_ERROR_LENGTH = 500;

const RUN_SELECT = {
  id: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  rangeStart: true,
  rangeEnd: true,
  rowsWritten: true,
  errorMessage: true,
} as const;

interface RunRow {
  id: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  rangeStart: Date;
  rangeEnd: Date;
  rowsWritten: number;
  errorMessage: string | null;
}

/** Fecha pura (AAAA-MM-DD) como la guarda la columna `date`. */
const toDbDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const toIsoDay = (date: Date): string => date.toISOString().slice(0, 10);

function toDto(run: RunRow): SyncRunResponseDto {
  return {
    ...run,
    rangeStart: toIsoDay(run.rangeStart),
    rangeEnd: toIsoDay(run.rangeEnd),
  };
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  /** Evita dos sincronizaciones simultáneas de la misma cuenta (una sola instancia). */
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: YoutubeTokenService,
    private readonly analytics: YoutubeAnalyticsClient,
  ) {}

  async sync(userId: string, id: string): Promise<SyncRunResponseDto> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id, userId },
      select: { id: true, platform: true, status: true },
    });
    if (!account) throw new NotFoundException(NOT_FOUND);
    // Cuando haya más plataformas, cada una tendrá su propia sincronización.
    if (account.platform !== 'YOUTUBE') {
      throw new BadRequestException('Esta plataforma todavía no es compatible');
    }
    if (account.status === 'REVOKED') throw new ConflictException(RECONNECT_MESSAGE);
    if (this.inFlight.has(id)) throw new ConflictException(RUNNING_MESSAGE);

    this.inFlight.add(id);
    try {
      await this.assertCanStart(id);
      return await this.execute(id);
    } finally {
      this.inFlight.delete(id);
    }
  }

  async getStatus(userId: string, id: string): Promise<SyncStatusResponseDto> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!account) throw new NotFoundException(NOT_FOUND);

    const lastRun = await this.prisma.syncRun.findFirst({
      where: { socialAccountId: id },
      orderBy: { startedAt: 'desc' },
      select: RUN_SELECT,
    });
    return { lastRun: lastRun ? toDto(lastRun) : null };
  }

  /** Una a la vez y como máximo una por minuto por cuenta. */
  private async assertCanStart(id: string): Promise<void> {
    const last = await this.prisma.syncRun.findFirst({
      where: { socialAccountId: id },
      orderBy: { startedAt: 'desc' },
      select: { id: true, status: true, startedAt: true },
    });
    if (!last) return;

    const age = Date.now() - last.startedAt.getTime();
    if (last.status === 'RUNNING') {
      if (age < STALE_RUN_MS) throw new ConflictException(RUNNING_MESSAGE);
      await this.prisma.syncRun.update({
        where: { id: last.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorMessage: 'Sincronización interrumpida (sin respuesta)',
        },
      });
      return;
    }
    if (age < COOLDOWN_MS) {
      throw new HttpException(COOLDOWN_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async execute(id: string): Promise<SyncRunResponseDto> {
    const today = pacificDate(new Date());
    const latest = await this.prisma.accountDailyMetric.aggregate({
      where: { socialAccountId: id },
      _max: { metricDate: true },
    });
    const range = planSyncRange(
      today,
      latest._max.metricDate ? toIsoDay(latest._max.metricDate) : null,
    );

    const run = await this.prisma.syncRun.create({
      data: {
        socialAccountId: id,
        rangeStart: toDbDate(range.start),
        rangeEnd: toDbDate(range.end),
      },
      select: { id: true },
    });

    try {
      await this.fetchAndStore(id, run.id, range, today);
    } catch (error) {
      await this.prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorMessage: this.describeFailure(error),
        },
      });
    }

    const finished = await this.prisma.syncRun.findUniqueOrThrow({
      where: { id: run.id },
      select: RUN_SELECT,
    });
    return toDto(finished);
  }

  /** Primero se lee todo; solo si todo llegó bien se escribe, en una única transacción. */
  private async fetchAndStore(
    accountId: string,
    runId: string,
    range: SyncRange,
    today: string,
  ): Promise<void> {
    const accessToken = await this.tokens.getAccessToken(accountId);
    const metrics = dailyMetricCodes('YOUTUBE');

    const report = await this.analytics.queryReport(accessToken, {
      startDate: range.start,
      endDate: range.end,
      metrics,
      dimensions: ['day'],
      sort: 'day',
    });
    if (report.statusCode !== 200) {
      throw new SyncDataError(
        `YouTube Analytics respondió ${report.statusCode}: ${extractApiError(report.body)}`,
      );
    }
    const table = parseReportTable(report.body);
    if (!table) {
      throw new SyncDataError('La respuesta de YouTube Analytics tiene un formato inesperado');
    }
    const rows = tableToMetricRows(table, metrics, range);

    const stats = await this.analytics.fetchChannelStatistics(accessToken);
    if (!stats) throw new SyncDataError('La cuenta de Google ya no tiene un canal de YouTube');

    await this.persist(accountId, runId, rows, statsToSnapshots(stats), today);
  }

  private persist(
    accountId: string,
    runId: string,
    rows: MetricRow[],
    snapshots: SnapshotRow[],
    snapshotDate: string,
  ): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      if (rows.length > 0) {
        // Un solo INSERT en lote. Sincronizar de nuevo el mismo día actualiza el valor
        // (YouTube puede corregirlo) y nunca duplica. `updatedAt` en UTC, como lo escribe Prisma.
        await tx.$executeRaw`
          INSERT INTO account_daily_metrics (id, "socialAccountId", "metricDate", metric, value, "updatedAt")
          SELECT gen_random_uuid(), ${accountId}::uuid, t.d::date, t.m, t.v, (now() AT TIME ZONE 'UTC')
          FROM unnest(
            ${rows.map((r) => r.date)}::text[],
            ${rows.map((r) => r.metric)}::text[],
            ${rows.map((r) => r.value)}::float8[]
          ) AS t(d, m, v)
          ON CONFLICT ("socialAccountId", "metricDate", metric)
          DO UPDATE SET value = EXCLUDED.value, "updatedAt" = (now() AT TIME ZONE 'UTC')`;
      }

      for (const snapshot of snapshots) {
        const key = {
          socialAccountId: accountId,
          snapshotDate: toDbDate(snapshotDate),
          metric: snapshot.metric,
        };
        await tx.accountTotalSnapshot.upsert({
          where: { socialAccountId_snapshotDate_metric: key },
          create: { ...key, value: snapshot.value },
          update: { value: snapshot.value },
        });
      }

      await tx.syncRun.update({
        where: { id: runId },
        data: {
          status: 'SUCCEEDED',
          finishedAt: new Date(),
          rowsWritten: rows.length + snapshots.length,
        },
      });
      await tx.socialAccount.update({
        where: { id: accountId },
        data: { lastSyncedAt: new Date() },
      });
    });
  }

  /** Mensaje del fallo listo para guardar y registrar: sin secretos y acotado. */
  private describeFailure(error: unknown): string {
    const raw =
      error instanceof HttpException || error instanceof SyncDataError
        ? error.message
        : safeErrorMessage(error);
    const message = redactSecrets(raw).slice(0, MAX_ERROR_LENGTH);
    this.logger.warn(`Falló la sincronización: ${message}`);
    return message;
  }
}