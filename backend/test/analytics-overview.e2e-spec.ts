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
const TEST_DOMAIN = '@analytics-overview-test.invalid';
const today = pacificDate(new Date());
/** Fecha del Pacífico de hace n días. */
const back = (n: number) => addDays(today, -n);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

interface Item {
  id?: string;
  metric?: string;
  value?: number | null;
  accountsIncluded?: number;
}

describe('Resumen global (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const api = () => request(app.getHttpServer());
  const login = () => registerAndLogin(app, TEST_DOMAIN);
  const overview = (cookie: string, query = '') =>
    api().get(`/api/v1/analytics/overview${query}`).set('Cookie', cookie);
  const byMetric = (items: Item[], metric: string): Item => {
    const found = items.find((item) => item.metric === metric);
    if (!found) throw new Error(`No hay ${metric}`);
    return found;
  };
  const byId = (items: Item[], id: string): Item => {
    const found = items.find((item) => item.id === id);
    if (!found) throw new Error(`No hay la cuenta ${id}`);
    return found;
  };

  const seedAccount = async (userId: string, status: 'ACTIVE' | 'REVOKED' = 'ACTIVE') => {
    const account = await prisma.socialAccount.create({
      data: { userId, platform: 'YOUTUBE', status, platformAccountId: `canal-${randomUUID()}` },
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

  /** Varios días seguidos: desde hace `from` días hasta hace `to` días (from >= to). */
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
    // Borrar usuarios elimina en cascada cuentas, métricas y totales.
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
    await app.close();
  });

  it('sin sesión responde 401', async () => {
    await api().get('/api/v1/analytics/overview').expect(401);
  });

  it('rechaza con 400 los parámetros inválidos, incluso sin cuentas', async () => {
    const user = await login();

    for (const query of [
      '?period=14d',
      `?period=7d&from=${back(5)}&to=${back(3)}`,
      `?from=${back(5)}`,
      '?daily=true', // parámetro que aquí no existe
      `?accountId=${randomUUID()}`, // tampoco existe
      '?from=2025-01-01&to=2026-10-01',
    ]) {
      await overview(user.cookie, query).expect(400);
    }
  });

  it('sin cuentas responde 200 con un mensaje que invita a conectar una', async () => {
    const user = await login();

    const res = await overview(user.cookie, '?period=7d').expect(200);

    expect(res.body).toMatchObject({
      period: null,
      dataThrough: null,
      accounts: [],
      platforms: [],
    });
    expect(res.body.message).toContain('conecta');
  });

  it('con cuentas pero sin datos no fija periodo y lo indica', async () => {
    const user = await login();
    await seedAccount(user.id);

    const res = await overview(user.cookie, '?period=7d').expect(200);

    expect(res.body.period).toBeNull();
    expect(res.body.message).toContain('sincron');
    expect(res.body.accounts[0].coverage).toBeNull();
    expect(res.body.platforms).toEqual([
      { platform: 'YOUTUBE', accountCount: 1, accountsWithData: 0, complete: false, metrics: [] },
    ]);
  });

  it('usa un rango común, suma por plataforma y marca el total como parcial si a una cuenta le faltan días', async () => {
    const user = await login();
    const a = await seedAccount(user.id);
    const b = await seedAccount(user.id);
    await seedRange(a, 9, 3, { views: 2 }); // 7 días, hasta hace 3
    await seedRange(b, 9, 5, { views: 1 }); // 5 días, hasta hace 5: va retrasada

    const res = await overview(user.cookie, '?period=7d').expect(200);

    // El rango común termina en el último dato de la cuenta más reciente.
    expect(res.body.period).toEqual({ kind: '7d', start: back(9), end: back(3), days: 7 });
    expect(res.body.dataThrough).toBe(back(3));

    const accountA = byId(res.body.accounts, a) as Item & {
      dataThrough: string;
      coverage: unknown;
    };
    const accountB = byId(res.body.accounts, b) as Item & {
      dataThrough: string;
      coverage: unknown;
    };
    expect(accountA.dataThrough).toBe(back(3));
    expect(accountA.coverage).toEqual({ daysWithData: 7, missingDays: 0, missingRanges: [] });
    expect(accountB.dataThrough).toBe(back(5));
    // La cuenta retrasada muestra sus días ausentes, no se esconden.
    expect(accountB.coverage).toEqual({
      daysWithData: 5,
      missingDays: 2,
      missingRanges: [{ from: back(4), to: back(3) }],
    });

    const platform = res.body.platforms[0];
    expect(platform).toMatchObject({
      platform: 'YOUTUBE',
      accountCount: 2,
      accountsWithData: 2,
      complete: false,
    });
    // 14 de una cuenta + 5 de la otra: es la suma de lo que hay, y se avisa de que es parcial.
    expect(byMetric(platform.metrics, 'views')).toMatchObject({ value: 19, accountsIncluded: 2 });
    expect(res.body.message).toContain('parciales');
  });

  it('la media global se pondera por las vistas de cada cuenta, no por un promedio simple', async () => {
    const user = await login();
    const a = await seedAccount(user.id);
    const b = await seedAccount(user.id);
    await seedDay(a, back(3), { views: 3, averageViewDuration: 25 });
    await seedDay(b, back(3), { views: 1, averageViewDuration: 10 });

    const res = await overview(user.cookie, `?from=${back(3)}&to=${back(3)}`).expect(200);
    const platform = res.body.platforms[0];

    // (25 × 3 + 10 × 1) ÷ 4 = 21,25; el promedio simple (17,5) sería incorrecto.
    expect(byMetric(platform.metrics, 'averageViewDuration')).toMatchObject({
      value: 21.25,
      accountsIncluded: 2,
    });
    expect(byMetric(platform.metrics, 'views')).toMatchObject({ value: 4, accountsIncluded: 2 });
    expect(platform.complete).toBe(true);
    expect(res.body.message).toBeNull();
  });

  it('los totales puntuales se muestran por cuenta y nunca se suman', async () => {
    const user = await login();
    const a = await seedAccount(user.id);
    const b = await seedAccount(user.id);
    await seedDay(a, back(3));
    await seedDay(b, back(3));
    await prisma.accountTotalSnapshot.create({
      data: { socialAccountId: a, snapshotDate: day(back(1)), metric: 'subscriberCount', value: 5 },
    });
    await prisma.accountTotalSnapshot.create({
      data: { socialAccountId: b, snapshotDate: day(back(1)), metric: 'subscriberCount', value: 7 },
    });

    const res = await overview(user.cookie, `?from=${back(3)}&to=${back(3)}`).expect(200);

    const totalOf = (id: string) => (byId(res.body.accounts, id) as { totals: Item[] }).totals;
    expect(byMetric(totalOf(a), 'subscriberCount').value).toBe(5);
    expect(byMetric(totalOf(b), 'subscriberCount').value).toBe(7);
    // La plataforma no tiene totales: sumar 5 + 7 contaría dos veces a quien siga a ambos canales.
    expect(res.body.platforms[0]).not.toHaveProperty('totals');
    expect(JSON.stringify(res.body.platforms)).not.toContain('subscriberCount');
  });

  it('entre plataformas no se suma nada mientras ninguna métrica sea compatible', async () => {
    const user = await login();
    const a = await seedAccount(user.id);
    await seedDay(a, back(3), { views: 3 });

    const res = await overview(user.cookie, '?period=7d').expect(200);

    expect(res.body.crossPlatform.groups).toEqual([]);
    expect(res.body.crossPlatform.message).toContain('compatible');
  });

  it('una cuenta REVOKED se incluye con su estado a la vista', async () => {
    const user = await login();
    const id = await seedAccount(user.id, 'REVOKED');
    await seedRange(id, 9, 3, { views: 1 });

    const res = await overview(user.cookie, '?period=7d').expect(200);

    expect(byId(res.body.accounts, id)).toMatchObject({ status: 'REVOKED' });
    expect(byMetric(res.body.platforms[0].metrics, 'views')).toMatchObject({ value: 7 });
  });

  it('aislamiento: nunca aparecen las cuentas de otro usuario', async () => {
    const owner = await login();
    const intruder = await login();
    const id = await seedAccount(owner.id);
    await seedRange(id, 9, 3, { views: 1 });

    const res = await overview(intruder.cookie, '?period=7d').expect(200);

    expect(res.body.accounts).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain(id);
  });
});