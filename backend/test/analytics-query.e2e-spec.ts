import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { dailyMetricCodes } from '../src/analytics/metric-catalog';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RATE_LIMIT_CONFIG } from '../src/auth/rate-limit.config';
import { addDays, pacificDate } from '../src/common/dates/pacific-date';
import { PrismaService } from '../src/prisma/prisma.service';
import { PERMISSIVE_RATE_LIMITS } from './helpers/rate-limits';
import { registerAndLogin } from './helpers/session';

// Dominio .invalid: reservado, nunca es un correo real.
const TEST_DOMAIN = '@analytics-query-test.invalid';
const today = pacificDate(new Date());
/** Fecha del Pacífico de hace n días. */
const back = (n: number) => addDays(today, -n);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('Estadísticas de una cuenta (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const api = () => request(app.getHttpServer());
  const login = () => registerAndLogin(app, TEST_DOMAIN);
  const get = (cookie: string, id: string, query = '') =>
    api().get(`/api/v1/analytics/accounts/${id}${query}`).set('Cookie', cookie);

  const seedAccount = async (userId: string) => {
    const account = await prisma.socialAccount.create({
      data: { userId, platform: 'YOUTUBE', platformAccountId: `canal-${randomUUID()}` },
    });
    return account.id;
  };

  /** Guarda las 8 métricas diarias de un día; las no indicadas valen 0 (un cero real). */
  const seedDay = (
    socialAccountId: string,
    date: string,
    values: Record<string, number> = {},
  ) =>
    prisma.accountDailyMetric.createMany({
      data: dailyMetricCodes('YOUTUBE').map((metric) => ({
        socialAccountId,
        metricDate: day(date),
        metric,
        value: values[metric] ?? 0,
      })),
    });

  const seedSnapshot = (socialAccountId: string, date: string, metric: string, value: number) =>
    prisma.accountTotalSnapshot.create({
      data: { socialAccountId, snapshotDate: day(date), metric, value },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RATE_LIMIT_CONFIG)
      .useValue(PERMISSIVE_RATE_LIMITS)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Borrar usuarios elimina en cascada cuentas y métricas.
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
    await app.close();
  });

  it('sin sesión responde 401', async () => {
    await api().get(`/api/v1/analytics/accounts/${randomUUID()}`).expect(401);
  });

  it('una cuenta sin datos responde 200 con un mensaje que indica sincronizar', async () => {
    const user = await login();
    const id = await seedAccount(user.id);

    const res = await get(user.cookie, id, '?period=7d').expect(200);

    expect(res.body).toMatchObject({
      period: null,
      dataThrough: null,
      daysBehind: null,
      coverage: null,
      metrics: [],
      totals: [],
    });
    expect(res.body.message).toContain('sincron');
    expect(res.body.account).toMatchObject({ id, platform: 'YOUTUBE', status: 'ACTIVE' });
  });

  it('un periodo predefinido termina en el último día con dato, no en hoy', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    for (let n = 12; n >= 3; n--) await seedDay(id, back(n));

    const res = await get(user.cookie, id, '?period=7d').expect(200);

    expect(res.body.period).toEqual({ kind: '7d', start: back(9), end: back(3), days: 7 });
    expect(res.body.dataThrough).toBe(back(3));
    expect(res.body.daysBehind).toBe(3);
    expect(res.body.coverage).toEqual({ daysWithData: 7, missingDays: 0, missingRanges: [] });
    expect(res.body.message).toBeNull();
  });

  it('suma lo sumable, pondera la duración media por vistas y lleva tipo, unidad y advertencia', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    await seedDay(id, back(5), { views: 3, averageViewDuration: 25, likes: 1 });
    await seedDay(id, back(4), { views: 1, averageViewDuration: 10 });
    await seedDay(id, back(3), { likes: 2 });

    const res = await get(user.cookie, id, '?period=7d').expect(200);
    const byMetric = Object.fromEntries(res.body.metrics.map((m: { metric: string }) => [m.metric, m]));

    expect(byMetric.views).toMatchObject({ kind: 'additive', unit: 'count', value: 4, daysWithData: 3 });
    expect(byMetric.likes.value).toBe(3);
    // (25 × 3 + 10 × 1 + 0 × 0) ÷ 4 = 21,25; el promedio simple (11,67) sería incorrecto.
    expect(byMetric.averageViewDuration).toMatchObject({
      kind: 'weighted_average',
      unit: 'seconds',
      value: 21.25,
      daysWithData: 3,
    });
    expect(byMetric.averageViewDuration.note).toContain('ponderada');
    expect(byMetric.estimatedMinutesWatched.note).toContain('enteros');

    // En el orden del catálogo, y sin ningún total puntual mezclado.
    expect(res.body.metrics.map((m: { metric: string }) => m.metric)).toEqual([
      'views',
      'estimatedMinutesWatched',
      'averageViewDuration',
      'likes',
      'comments',
      'shares',
      'subscribersGained',
      'subscribersLost',
    ]);

    // Solo 3 de los 7 días del periodo tienen dato: los demás se señalan, no se rellenan.
    expect(res.body.coverage).toEqual({
      daysWithData: 3,
      missingDays: 4,
      missingRanges: [{ from: back(9), to: back(6) }],
    });
  });

  it('un rango personalizado se respeta, un cero real cuenta y los días ausentes se señalan', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    await seedDay(id, back(8), { views: 2 });
    await seedDay(id, back(7), { views: 0 }); // un cero real: es dato
    await seedDay(id, back(5), { views: 5 });

    const res = await get(user.cookie, id, `?from=${back(8)}&to=${back(3)}`).expect(200);

    expect(res.body.period).toEqual({ kind: 'custom', start: back(8), end: back(3), days: 6 });
    expect(res.body.coverage).toEqual({
      daysWithData: 3,
      missingDays: 3,
      missingRanges: [
        { from: back(6), to: back(6) },
        { from: back(4), to: back(3) },
      ],
    });
    const views = res.body.metrics.find((m: { metric: string }) => m.metric === 'views');
    expect(views).toMatchObject({ value: 7, daysWithData: 3 });
  });

  it('rechaza con 400 los parámetros de periodo inválidos', async () => {
    const user = await login();
    const id = await seedAccount(user.id);

    for (const query of [
      '?period=14d',
      `?period=7d&from=${back(5)}&to=${back(3)}`,
      `?from=${back(5)}`,
      `?to=${back(3)}`,
      '?from=2026-02-30&to=2026-03-01',
      `?from=${back(3)}&to=${back(5)}`,
      `?from=${today}&to=${addDays(today, 1)}`,
      '?from=2025-01-01&to=2026-10-01',
      '?from=20261001&to=20261002',
      '?daily=quizas',
    ]) {
      await get(user.cookie, id, query).expect(400);
    }
  });

  it('sin parámetros usa 30 días', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    await seedDay(id, back(3));

    const res = await get(user.cookie, id).expect(200);

    expect(res.body.period).toEqual({ kind: '30d', start: back(32), end: back(3), days: 30 });
  });

  it('daily=true añade la serie diaria solo con los días que tienen dato', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    await seedDay(id, back(5), { views: 3 });
    await seedDay(id, back(3), { views: 1 });

    const res = await get(user.cookie, id, '?period=7d&daily=true').expect(200);

    expect(res.body.daily.map((point: { date: string }) => point.date)).toEqual([back(5), back(3)]);
    expect(res.body.daily[0].values.views).toBe(3);
    expect(Object.keys(res.body.daily[0].values)).toHaveLength(8);

    const without = await get(user.cookie, id, '?period=7d').expect(200);
    expect(without.body).not.toHaveProperty('daily');
  });

  it('los totales son los más recientes de cada métrica y no dependen del periodo', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    await seedSnapshot(id, back(2), 'subscriberCount', 4);
    await seedSnapshot(id, back(1), 'subscriberCount', 5);
    await seedSnapshot(id, back(2), 'viewCount', 3);

    const res = await get(user.cookie, id, '?period=7d').expect(200);

    expect(res.body.period).toBeNull(); // sin métricas diarias, pero los totales sí se muestran
    expect(res.body.totals).toHaveLength(2);
    expect(res.body.totals[0]).toMatchObject({
      metric: 'subscriberCount',
      value: 5,
      capturedOn: back(1),
      unit: 'count',
    });
    expect(res.body.totals[0].note).toContain('redondearlo');
    expect(res.body.totals[1]).toMatchObject({ metric: 'viewCount', value: 3, capturedOn: back(2) });
  });

  it('aislamiento: consultar la cuenta de otro usuario responde 404', async () => {
    const owner = await login();
    const intruder = await login();
    const id = await seedAccount(owner.id);
    await seedDay(id, back(3));

    await get(intruder.cookie, id, '?period=7d').expect(404);
  });

  it('un ID que no es UUID responde 400', async () => {
    const user = await login();
    await api()
      .get('/api/v1/analytics/accounts/no-es-un-uuid')
      .set('Cookie', user.cookie)
      .expect(400);
  });
});