import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
import { shapeProblems } from './helpers/shape';
import { TERMS } from './helpers/terms';

// Dominio .invalid: reservado, nunca es un correo real.
const TEST_DOMAIN = '@contracts-test.invalid';
const PASSWORD = 'una-clave-larga-1234';

// El frontend declara aquí la forma de lo que necesita recibir (repositorio con backend/ y frontend/).
const CONTRACTS_DIR = join(__dirname, '..', '..', 'frontend', 'src', 'api', 'contracts');
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(CONTRACTS_DIR, `${name}.json`), 'utf8'));

const COVERED = [
  'account-analytics',
  'auth-user',
  'catalog',
  'compare',
  'disconnect',
  'overview',
  'profile',
  'social-account',
  'sync-run',
];

const today = pacificDate(new Date());
/** Fecha del Pacífico de hace n días. */
const back = (n: number) => addDays(today, -n);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('Contrato con el frontend (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie = '';
  let userId = '';
  let accountId = '';
  let registered: unknown;
  let loggedIn: unknown;

  const api = () => request(app.getHttpServer());
  const get = (path: string) => api().get(`/api/v1${path}`).set('Cookie', cookie);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RATE_LIMIT_CONFIG)
      .useValue(PERMISSIVE_RATE_LIMITS)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const email = `${randomUUID()}${TEST_DOMAIN}`;
    const registerRes = await api()
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD, displayName: 'Ana', ...TERMS })
      .expect(201);
    registered = registerRes.body;
    userId = registerRes.body.id;

    const loginRes = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    loggedIn = loginRes.body;
    const raw = ([] as string[])
      .concat(loginRes.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('sp_session='));
    cookie = raw ? raw.split(';')[0] : '';

    // Una cuenta con 14 días de datos: 7 del periodo actual y 7 del anterior, para que cada
    // campo de las respuestas tenga un valor típico (no nulo).
    const account = await prisma.socialAccount.create({
      data: {
        userId,
        platform: 'YOUTUBE',
        platformAccountId: `canal-${randomUUID()}`,
        displayName: 'Canal de prueba',
        handle: '@canal',
        status: 'ACTIVE',
        lastSyncedAt: new Date(),
      },
    });
    accountId = account.id;

    for (let n = 16; n >= 3; n--) {
      const isCurrent = n <= 9;
      await prisma.accountDailyMetric.createMany({
        data: dailyMetricCodes('YOUTUBE').map((metric) => ({
          socialAccountId: accountId,
          metricDate: day(back(n)),
          metric,
          value:
            metric === 'views' ? (isCurrent ? 2 : 1) : metric === 'averageViewDuration' ? (isCurrent ? 20 : 10) : 0,
        })),
      });
    }
    for (const [metric, value] of [['subscriberCount', 5], ['viewCount', 3], ['videoCount', 1]] as const) {
      await prisma.accountTotalSnapshot.create({
        data: { socialAccountId: accountId, snapshotDate: day(back(1)), metric, value },
      });
    }
    await prisma.syncRun.create({
      data: {
        socialAccountId: accountId,
        status: 'SUCCEEDED',
        finishedAt: new Date(),
        rangeStart: day(back(89)),
        rangeEnd: day(today),
        rowsWritten: 699,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
    await app.close();
  });

  it('cada JSON del frontend tiene su comprobación en este archivo', () => {
    const files = readdirSync(CONTRACTS_DIR)
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace(/\.json$/, ''))
      .sort();

    expect(files).toEqual(COVERED);
  });

  it('register y login devuelven el usuario con la forma que el frontend espera', () => {
    expect(shapeProblems(registered, fixture('auth-user'))).toEqual([]);
    expect(shapeProblems(loggedIn, fixture('auth-user'))).toEqual([]);
  });

  it('GET /users/me', async () => {
    const res = await get('/users/me').expect(200);

    expect(shapeProblems(res.body, fixture('profile'))).toEqual([]);
  });

  it('GET /social-accounts', async () => {
    const res = await get('/social-accounts').expect(200);

    expect(shapeProblems(res.body, [fixture('social-account')])).toEqual([]);
  });

  it('GET /social-accounts/:id/sync-status (la misma forma que devuelve POST /sync)', async () => {
    const res = await get(`/social-accounts/${accountId}/sync-status`).expect(200);

    expect(shapeProblems(res.body.lastRun, fixture('sync-run'))).toEqual([]);
  });

  it('DELETE /social-accounts/:id', async () => {
    // Una cuenta sin credencial: no hay nada que revocar en Google.
    const other = await prisma.socialAccount.create({
      data: { userId, platform: 'YOUTUBE', platformAccountId: `canal-${randomUUID()}` },
    });

    const res = await api()
      .delete(`/api/v1/social-accounts/${other.id}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(shapeProblems(res.body, fixture('disconnect'))).toEqual([]);
  });

  it('GET /analytics/metrics', async () => {
    const res = await get('/analytics/metrics').expect(200);

    expect(shapeProblems(res.body, fixture('catalog'))).toEqual([]);
  });

  it('GET /analytics/compare', async () => {
    const res = await get(`/analytics/compare?accountId=${accountId}&period=7d`).expect(200);

    expect(shapeProblems(res.body, fixture('compare'))).toEqual([]);
  });

  it('GET /analytics/accounts/:id con la serie diaria', async () => {
    const res = await get(`/analytics/accounts/${accountId}?period=7d&daily=true`).expect(200);

    expect(shapeProblems(res.body, fixture('account-analytics'))).toEqual([]);
  });

  it('GET /analytics/overview', async () => {
    const res = await get('/analytics/overview?period=7d').expect(200);

    expect(shapeProblems(res.body, fixture('overview'))).toEqual([]);
  });
});