import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { dailyMetricCodes } from '../src/analytics/metric-catalog';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RATE_LIMIT_CONFIG } from '../src/auth/rate-limit.config';
import { credentialAad, TokenCipherService } from '../src/common/crypto/token-cipher.service';
import { addDays, pacificDate } from '../src/common/dates/pacific-date';
import {
  ChannelStatistics,
  RawReport,
  ReportQuery,
  YoutubeAnalyticsClient,
} from '../src/integrations/youtube/youtube-analytics.client';
import { YOUTUBE_SCOPES } from '../src/integrations/youtube/youtube-oauth.client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PERMISSIVE_RATE_LIMITS } from './helpers/rate-limits';
import { registerAndLogin } from './helpers/session';

// Dominio .invalid: reservado, nunca es un correo real.
const TEST_DOMAIN = '@sync-test.invalid';
const DAILY = dailyMetricCodes('YOUTUBE').length;
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Tabla diaria desde startDate hasta `endDate - lastOffset` (simula el retraso de la API). */
function dailyTable(
  query: ReportQuery,
  valueOf: (date: string, metric: string) => number = () => 1,
  lastOffset = 2,
): RawReport {
  const last = addDays(query.endDate, -lastOffset);
  const rows: Array<Array<string | number>> = [];
  for (let date = query.startDate; date <= last; date = addDays(date, 1)) {
    rows.push([date, ...query.metrics.map((metric) => valueOf(date, metric))]);
  }
  return {
    statusCode: 200,
    body: { columnHeaders: ['day', ...query.metrics].map((name) => ({ name })), rows },
  };
}

const DEFAULT_STATS: ChannelStatistics = {
  viewCount: '3',
  subscriberCount: '5',
  videoCount: '1',
  hiddenSubscriberCount: false,
};

class FakeAnalyticsClient extends YoutubeAnalyticsClient {
  calls: ReportQuery[] = [];
  report: (query: ReportQuery) => RawReport = (query) => dailyTable(query);
  statistics: ChannelStatistics | null = DEFAULT_STATS;
  failStatistics = false;

  async queryReport(_accessToken: string, query: ReportQuery): Promise<RawReport> {
    this.calls.push(query);
    return this.report(query);
  }
  async fetchChannelStatistics(): Promise<ChannelStatistics | null> {
    if (this.failStatistics) throw new Error('fallo simulado de YouTube');
    return this.statistics;
  }
}

describe('Sincronización (e2e)', () => {
  const fake = new FakeAnalyticsClient();
  const today = pacificDate(new Date());
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cipher: TokenCipherService;

  const api = () => request(app.getHttpServer());
  const login = () => registerAndLogin(app, TEST_DOMAIN);
  const sync = (cookie: string, id: string) =>
    api().post(`/api/v1/social-accounts/${id}/sync`).set('Cookie', cookie);
  const syncStatus = (cookie: string, id: string) =>
    api().get(`/api/v1/social-accounts/${id}/sync-status`).set('Cookie', cookie);

  const seedAccount = async (
    userId: string,
    options: { platform?: 'YOUTUBE' | 'INSTAGRAM'; status?: 'ACTIVE' | 'REVOKED'; credential?: boolean } = {},
  ) => {
    const { platform = 'YOUTUBE', status = 'ACTIVE', credential = true } = options;
    const id = randomUUID();
    await prisma.socialAccount.create({
      data: {
        id,
        userId,
        platform,
        status,
        platformAccountId: `canal-${randomUUID()}`,
        ...(credential
          ? {
              credential: {
                create: {
                  accessTokenEnc: cipher.encrypt(`acceso-${randomUUID()}`, credentialAad(id, 'access')),
                  refreshTokenEnc: cipher.encrypt(`refresco-${randomUUID()}`, credentialAad(id, 'refresh')),
                  expiresAt: new Date(Date.now() + 3_600_000),
                  scopes: [...YOUTUBE_SCOPES],
                  keyVersion: cipher.keyVersion,
                },
              },
            }
          : {}),
      },
    });
    return id;
  };

  /** Hace que la última ejecución parezca de hace 2 minutos, para saltar el límite por minuto. */
  const backdateRuns = (socialAccountId: string) =>
    prisma.syncRun.updateMany({
      where: { socialAccountId },
      data: { startedAt: new Date(Date.now() - 120_000) },
    });

  const metricCount = (socialAccountId: string) =>
    prisma.accountDailyMetric.count({ where: { socialAccountId } });

  beforeEach(() => {
    fake.calls = [];
    fake.report = (query) => dailyTable(query);
    fake.statistics = DEFAULT_STATS;
    fake.failStatistics = false;
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(YoutubeAnalyticsClient)
      .useValue(fake)
      .overrideProvider(RATE_LIMIT_CONFIG)
      .useValue(PERMISSIVE_RATE_LIMITS)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    cipher = app.get(TokenCipherService);
  });

  afterAll(async () => {
    // Borrar usuarios elimina en cascada cuentas, métricas, totales y sincronizaciones.
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
    await app.close();
  });

  it('sin sesión, sincronizar y consultar el estado responden 401', async () => {
    const id = randomUUID();
    await api().post(`/api/v1/social-accounts/${id}/sync`).expect(401);
    await api().get(`/api/v1/social-accounts/${id}/sync-status`).expect(401);
  });

  it('la primera sincronización trae 90 días, guarda ceros reales y ninguna fila para los días que la API aún no tiene', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    fake.report = (query) =>
      dailyTable(query, (date, metric) =>
        metric === 'views' && Number(date.slice(-2)) % 2 === 0 ? 0 : 1,
      );

    const res = await sync(user.cookie, id).expect(200);

    expect(res.body.status).toBe('SUCCEEDED');
    expect(res.body.errorMessage).toBeNull();
    expect(res.body.rangeStart).toBe(addDays(today, -89));
    expect(res.body.rangeEnd).toBe(today);
    // 88 días (la simulación tiene 2 días de retraso) × 8 métricas + 3 totales.
    expect(res.body.rowsWritten).toBe(88 * DAILY + 3);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toMatchObject({
      startDate: addDays(today, -89),
      endDate: today,
      dimensions: ['day'],
    });
    expect([...fake.calls[0].metrics]).toEqual(dailyMetricCodes('YOUTUBE'));

    expect(await metricCount(id)).toBe(88 * DAILY);
    // Un cero que informa la API es un dato real y se guarda.
    expect(
      await prisma.accountDailyMetric.count({
        where: { socialAccountId: id, metric: 'views', value: 0 },
      }),
    ).toBeGreaterThan(0);
    // Los días que la API todavía no tiene no generan filas.
    expect(
      await prisma.accountDailyMetric.count({
        where: { socialAccountId: id, metricDate: { gt: day(addDays(today, -2)) } },
      }),
    ).toBe(0);

    const snapshots = await prisma.accountTotalSnapshot.findMany({
      where: { socialAccountId: id },
      orderBy: { metric: 'asc' },
    });
    expect(snapshots.map((s) => [s.metric, s.value])).toEqual([
      ['subscriberCount', 5],
      ['videoCount', 1],
      ['viewCount', 3],
    ]);
    expect((await prisma.socialAccount.findUniqueOrThrow({ where: { id } })).lastSyncedAt).not.toBeNull();
  });

  it('sincronizar de nuevo no duplica, relee solo la ventana reciente y aplica las correcciones', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    await sync(user.cookie, id).expect(200);
    expect(await metricCount(id)).toBe(88 * DAILY);

    // YouTube corrige un valor de hace 3 días.
    fake.report = (query) =>
      dailyTable(query, (date, metric) =>
        metric === 'views' && date === addDays(today, -3) ? 99 : 1,
      );
    await backdateRuns(id);
    const second = await sync(user.cookie, id).expect(200);

    expect(second.body.status).toBe('SUCCEEDED');
    // El último dato es de hoy-2, así que se relee desde 6 días antes.
    expect(fake.calls[1].startDate).toBe(addDays(today, -8));
    expect(second.body.rowsWritten).toBe(7 * DAILY + 3);
    // Sin duplicados.
    expect(await metricCount(id)).toBe(88 * DAILY);
    expect(
      await prisma.accountDailyMetric.count({ where: { socialAccountId: id, metric: 'views', metricDate: day(addDays(today, -3)) } }),
    ).toBe(1);
    // Y con la corrección aplicada.
    const corrected = await prisma.accountDailyMetric.findFirstOrThrow({
      where: { socialAccountId: id, metric: 'views', metricDate: day(addDays(today, -3)) },
    });
    expect(corrected.value).toBe(99);
    expect(await prisma.accountTotalSnapshot.count({ where: { socialAccountId: id } })).toBe(3);
    expect(await prisma.syncRun.count({ where: { socialAccountId: id, status: 'SUCCEEDED' } })).toBe(2);
  });

  it('una segunda sincronización inmediata responde 429 y no contacta a YouTube', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    await sync(user.cookie, id).expect(200);

    await sync(user.cookie, id).expect(429);
    expect(fake.calls).toHaveLength(1);
  });

  it('una ejecución en curso responde 409; una antigua se da por interrumpida', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    const stale = await prisma.syncRun.create({
      data: {
        socialAccountId: id,
        status: 'RUNNING',
        startedAt: new Date(Date.now() - 60_000),
        rangeStart: day(addDays(today, -6)),
        rangeEnd: day(today),
      },
    });

    await sync(user.cookie, id).expect(409);
    expect(fake.calls).toHaveLength(0);

    await prisma.syncRun.update({
      where: { id: stale.id },
      data: { startedAt: new Date(Date.now() - 10 * 60_000) },
    });
    const res = await sync(user.cookie, id).expect(200);

    expect(res.body.status).toBe('SUCCEEDED');
    const old = await prisma.syncRun.findUniqueOrThrow({ where: { id: stale.id } });
    expect(old.status).toBe('FAILED');
    expect(old.errorMessage).toContain('interrumpida');
  });

  it('si YouTube Analytics falla, queda registrado sin secretos y no se escribe nada', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    fake.report = () => ({
      statusCode: 403,
      body: { error: { message: 'Falló con Bearer abc.def-ghi y ya29.a0AfB_ejemplo-secreto' } },
    });

    const res = await sync(user.cookie, id).expect(200);

    expect(res.body.status).toBe('FAILED');
    expect(res.body.errorMessage).toContain('403');
    expect(res.body.errorMessage).not.toContain('abc.def-ghi');
    expect(res.body.errorMessage).not.toContain('ejemplo-secreto');
    expect(await metricCount(id)).toBe(0);
    expect(await prisma.accountTotalSnapshot.count({ where: { socialAccountId: id } })).toBe(0);
    expect((await prisma.socialAccount.findUniqueOrThrow({ where: { id } })).lastSyncedAt).toBeNull();
  });

  it('una respuesta con datos inválidos se rechaza completa: no se guarda ni una fila', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    fake.report = (query) => ({
      statusCode: 200,
      body: {
        columnHeaders: ['day', ...query.metrics].map((name) => ({ name })),
        rows: [
          [addDays(today, -3), ...query.metrics.map(() => 1)],
          ['no-es-fecha', ...query.metrics.map(() => 1)],
        ],
      },
    });

    const res = await sync(user.cookie, id).expect(200);

    expect(res.body.status).toBe('FAILED');
    expect(res.body.errorMessage).toContain('fecha');
    expect(await metricCount(id)).toBe(0);
  });

  it('si fallan los totales del canal, tampoco se guardan las métricas diarias (todo o nada)', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    fake.failStatistics = true;

    const res = await sync(user.cookie, id).expect(200);

    expect(res.body.status).toBe('FAILED');
    expect(await metricCount(id)).toBe(0);
    expect(await prisma.accountTotalSnapshot.count({ where: { socialAccountId: id } })).toBe(0);
  });

  it('una cuenta REVOKED responde 409 y no contacta a YouTube ni crea ejecuciones', async () => {
    const user = await login();
    const id = await seedAccount(user.id, { status: 'REVOKED', credential: false });

    await sync(user.cookie, id).expect(409);
    expect(fake.calls).toHaveLength(0);
    expect(await prisma.syncRun.count({ where: { socialAccountId: id } })).toBe(0);
  });

  it('aislamiento: sincronizar o consultar la cuenta de otro usuario responde 404', async () => {
    const owner = await login();
    const intruder = await login();
    const id = await seedAccount(owner.id);

    await sync(intruder.cookie, id).expect(404);
    await syncStatus(intruder.cookie, id).expect(404);
    expect(fake.calls).toHaveLength(0);
    expect(await prisma.syncRun.count({ where: { socialAccountId: id } })).toBe(0);
  });

  it('sync-status devuelve null sin ejecuciones y luego la última', async () => {
    const user = await login();
    const id = await seedAccount(user.id);

    const before = await syncStatus(user.cookie, id).expect(200);
    expect(before.body).toEqual({ lastRun: null });

    await sync(user.cookie, id).expect(200);
    const after = await syncStatus(user.cookie, id).expect(200);

    expect(after.body.lastRun.status).toBe('SUCCEEDED');
    expect(after.body.lastRun.rowsWritten).toBe(88 * DAILY + 3);
    expect(after.body.lastRun.rangeEnd).toBe(today);
  });

  it('una plataforma sin sincronización responde 400', async () => {
    const user = await login();
    const id = await seedAccount(user.id, { platform: 'INSTAGRAM', credential: false });

    await sync(user.cookie, id).expect(400);
    expect(fake.calls).toHaveLength(0);
  });
});