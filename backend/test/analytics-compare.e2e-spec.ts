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
const TEST_DOMAIN = '@analytics-compare-test.invalid';
const today = pacificDate(new Date());
/** Fecha del Pacífico de hace n días. */
const back = (n: number) => addDays(today, -n);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

interface ComparedMetric {
  metric: string;
  comparable: boolean;
  reasonCode: string | null;
  reason: string | null;
  change: number | null;
  changePercent: number | null;
  current: { value: number | null; daysWithData: number };
  previous: { value: number | null; daysWithData: number };
}

describe('Comparación de periodos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const api = () => request(app.getHttpServer());
  const login = () => registerAndLogin(app, TEST_DOMAIN);
  const compare = (cookie: string, query: string) =>
    api().get(`/api/v1/analytics/compare${query}`).set('Cookie', cookie);
  const find = (metrics: ComparedMetric[], metric: string): ComparedMetric => {
    const found = metrics.find((m) => m.metric === metric);
    if (!found) throw new Error(`No hay comparación de ${metric}`);
    return found;
  };

  const seedAccount = async (userId: string) => {
    const account = await prisma.socialAccount.create({
      data: { userId, platform: 'YOUTUBE', platformAccountId: `canal-${randomUUID()}` },
    });
    return account.id;
  };

  /** Guarda las 8 métricas diarias de un día; las no indicadas valen 0 (un cero real). */
  const seedDay = (socialAccountId: string, date: string, values: Record<string, number> = {}) =>
    prisma.accountDailyMetric.createMany({
      data: dailyMetricCodes('YOUTUBE').map((metric) => ({
        socialAccountId,
        metricDate: day(date),
        metric,
        value: values[metric] ?? 0,
      })),
    });

  /** Guarda varios días seguidos: desde hace `from` días hasta hace `to` días (from >= to). */
  const seedRange = async (
    id: string,
    from: number,
    to: number,
    values: Record<string, number>,
  ) => {
    for (let n = from; n >= to; n--) await seedDay(id, back(n), values);
  };

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
    await api().get(`/api/v1/analytics/compare?accountId=${randomUUID()}`).expect(401);
  });

  it('rechaza con 400 los parámetros inválidos y con 404 una cuenta inexistente', async () => {
    const user = await login();
    const id = await seedAccount(user.id);

    for (const query of [
      '?period=7d', // falta accountId
      '?accountId=no-es-un-uuid',
      `?accountId=${id}&daily=true`, // parámetro que aquí no existe
      `?accountId=${id}&period=14d`,
      `?accountId=${id}&period=7d&from=${back(5)}&to=${back(3)}`,
      `?accountId=${id}&from=${back(5)}`,
      `?accountId=${id}&from=${today}&to=${addDays(today, 1)}`,
    ]) {
      await compare(user.cookie, query).expect(400);
    }
    await compare(user.cookie, `?accountId=${randomUUID()}&period=7d`).expect(404);
  });

  it('una cuenta sin datos responde 200 con un mensaje que indica sincronizar', async () => {
    const user = await login();
    const id = await seedAccount(user.id);

    const res = await compare(user.cookie, `?accountId=${id}&period=7d`).expect(200);

    expect(res.body).toMatchObject({
      dataThrough: null,
      current: null,
      previous: null,
      comparable: false,
      metrics: [],
    });
    expect(res.body.message).toContain('sincron');
  });

  it('el periodo anterior es inmediato y de la misma longitud, y las métricas se comparan', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    await seedRange(id, 9, 3, { views: 2, averageViewDuration: 20 }); // actual: 7 días
    await seedRange(id, 16, 10, { views: 1, averageViewDuration: 10 }); // anterior: 7 días

    const res = await compare(user.cookie, `?accountId=${id}&period=7d`).expect(200);

    expect(res.body.current.period).toEqual({ kind: '7d', start: back(9), end: back(3), days: 7 });
    expect(res.body.previous.period).toEqual({
      kind: 'previous',
      start: back(16),
      end: back(10),
      days: 7,
    });
    expect(res.body.current.coverage.missingDays).toBe(0);
    expect(res.body.previous.coverage.missingDays).toBe(0);
    expect(res.body.comparable).toBe(true);
    expect(res.body.message).toBeNull();

    const views = find(res.body.metrics, 'views');
    expect(views).toMatchObject({
      comparable: true,
      change: 7,
      changePercent: 100,
      current: { value: 14, daysWithData: 7 },
      previous: { value: 7, daysWithData: 7 },
    });
    // Duración media ponderada: 20 frente a 10.
    expect(find(res.body.metrics, 'averageViewDuration')).toMatchObject({
      comparable: true,
      change: 10,
      changePercent: 100,
    });
  });

  it('con distinta cobertura no compara las sumables en silencio, pero sí la media ponderada', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    await seedRange(id, 9, 3, { views: 2, averageViewDuration: 20 }); // actual: 7 días
    await seedRange(id, 13, 10, { views: 1, averageViewDuration: 10 }); // anterior: solo 4 de 7

    const res = await compare(user.cookie, `?accountId=${id}&period=7d`).expect(200);

    expect(res.body.previous.coverage).toEqual({
      daysWithData: 4,
      missingDays: 3,
      missingRanges: [{ from: back(16), to: back(14) }],
    });
    expect(res.body.comparable).toBe(false);
    expect(res.body.message).toContain('cobertura');

    const views = find(res.body.metrics, 'views');
    expect(views).toMatchObject({
      comparable: false,
      reasonCode: 'DIFFERENT_COVERAGE',
      change: null,
      changePercent: null,
      current: { value: 14, daysWithData: 7 },
      previous: { value: 4, daysWithData: 4 },
    });
    expect(views.reason).toContain('7 y 4');
    expect(find(res.body.metrics, 'averageViewDuration')).toMatchObject({
      comparable: true,
      change: 10,
    });
  });

  it('si el periodo anterior no tiene datos, lo dice y no compara', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    await seedRange(id, 9, 3, { views: 2 }); // solo hay datos en el periodo actual

    const res = await compare(user.cookie, `?accountId=${id}&period=7d`).expect(200);

    expect(res.body.previous.coverage).toEqual({
      daysWithData: 0,
      missingDays: 7,
      missingRanges: [{ from: back(16), to: back(10) }],
    });
    expect(res.body.comparable).toBe(false);
    expect(res.body.message).toContain('periodo anterior');
    expect(find(res.body.metrics, 'views')).toMatchObject({
      comparable: false,
      reasonCode: 'MISSING_DATA',
      previous: { value: null, daysWithData: 0 },
    });
  });

  it('un valor anterior de cero no da porcentaje, y una media sin vistas no es comparable', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    await seedRange(id, 9, 3, { views: 1, averageViewDuration: 20 });
    await seedRange(id, 16, 10, {}); // ceros reales: hay dato, pero no hubo vistas

    const res = await compare(user.cookie, `?accountId=${id}&period=7d`).expect(200);

    expect(find(res.body.metrics, 'views')).toMatchObject({
      comparable: true,
      change: 7,
      changePercent: null,
    });
    expect(find(res.body.metrics, 'averageViewDuration')).toMatchObject({
      comparable: false,
      reasonCode: 'MISSING_DATA',
      current: { value: 20 },
      previous: { value: null },
    });
    expect(res.body.comparable).toBe(false);
    expect(res.body.message).toContain('averageViewDuration');
  });

  it('un rango personalizado se compara con el rango anterior de la misma longitud', async () => {
    const user = await login();
    const id = await seedAccount(user.id);
    await seedRange(id, 13, 4, { views: 1 });

    const res = await compare(
      user.cookie,
      `?accountId=${id}&from=${back(8)}&to=${back(4)}`,
    ).expect(200);

    expect(res.body.current.period).toEqual({ kind: 'custom', start: back(8), end: back(4), days: 5 });
    expect(res.body.previous.period).toEqual({
      kind: 'previous',
      start: back(13),
      end: back(9),
      days: 5,
    });
    expect(find(res.body.metrics, 'views')).toMatchObject({
      comparable: true,
      change: 0,
      current: { value: 5 },
      previous: { value: 5 },
    });
  });

  it('aislamiento: comparar la cuenta de otro usuario responde 404, igual que un ID inexistente', async () => {
    const owner = await login();
    const intruder = await login();
    const id = await seedAccount(owner.id);
    await seedRange(id, 9, 3, { views: 1 });

    const other = await compare(intruder.cookie, `?accountId=${id}&period=7d`).expect(404);
    const missing = await compare(intruder.cookie, `?accountId=${randomUUID()}&period=7d`).expect(404);
    expect(other.body).toEqual(missing.body);
  });
});