import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  ANALYTICS_PROBE_ENABLED,
  CANDIDATE_METRICS,
} from '../src/analytics/analytics-probe.service';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RATE_LIMIT_CONFIG } from '../src/auth/rate-limit.config';
import { credentialAad, TokenCipherService } from '../src/common/crypto/token-cipher.service';
import { addDays } from '../src/common/dates/pacific-date';
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
const TEST_DOMAIN = '@analytics-probe-test.invalid';

/** Genera una tabla diaria desde startDate hasta `endDate - lastOffset` días (simula el retraso). */
function table(query: ReportQuery, lastOffset = 2): RawReport {
  const last = addDays(query.endDate, -lastOffset);
  const rows: Array<Array<string | number>> = [];
  for (let day = query.startDate; day <= last; day = addDays(day, 1)) {
    rows.push([day, ...query.metrics.map(() => 5)]);
  }
  return {
    statusCode: 200,
    body: {
      columnHeaders: ['day', ...query.metrics].map((name) => ({ name })),
      rows,
    },
  };
}

/** Por defecto `dislikes` falla (como si la API no lo ofreciera) y el resto responde. */
const defaultHandler = (query: ReportQuery): RawReport =>
  query.metrics.includes('dislikes')
    ? { statusCode: 400, body: { error: { code: 400, message: 'Unknown metric: dislikes' } } }
    : table(query);

class FakeAnalyticsClient extends YoutubeAnalyticsClient {
  calls: ReportQuery[] = [];
  handler: (query: ReportQuery) => RawReport = defaultHandler;
  statistics: ChannelStatistics | null = null;

  async queryReport(_accessToken: string, query: ReportQuery): Promise<RawReport> {
    this.calls.push(query);
    return this.handler(query);
  }
  async fetchChannelStatistics(): Promise<ChannelStatistics | null> {
    return this.statistics;
  }
}

async function buildApp(
  fake: FakeAnalyticsClient,
  probeEnabled?: boolean,
): Promise<INestApplication<App>> {
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(YoutubeAnalyticsClient)
    .useValue(fake)
    .overrideProvider(RATE_LIMIT_CONFIG)
    .useValue(PERMISSIVE_RATE_LIMITS);
  if (probeEnabled !== undefined) {
    builder.overrideProvider(ANALYTICS_PROBE_ENABLED).useValue(probeEnabled);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

describe('Sondeo de YouTube Analytics (e2e, temporal)', () => {
  const fake = new FakeAnalyticsClient();
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cipher: TokenCipherService;

  const api = () => request(app.getHttpServer());
  const login = () => registerAndLogin(app, TEST_DOMAIN);
  const probe = (cookie: string, id: string, query = '') =>
    api().get(`/api/v1/analytics/probe/${id}${query}`).set('Cookie', cookie);

  /** Cuenta de YouTube con un token vigente (no hace falta renovarlo). */
  const seedAccount = async (userId: string) => {
    const id = randomUUID();
    const accessToken = `acceso-${randomUUID()}`;
    await prisma.socialAccount.create({
      data: {
        id,
        userId,
        platform: 'YOUTUBE',
        platformAccountId: `canal-${randomUUID()}`,
        credential: {
          create: {
            accessTokenEnc: cipher.encrypt(accessToken, credentialAad(id, 'access')),
            refreshTokenEnc: cipher.encrypt(`refresco-${randomUUID()}`, credentialAad(id, 'refresh')),
            expiresAt: new Date(Date.now() + 3_600_000),
            scopes: [...YOUTUBE_SCOPES],
            keyVersion: cipher.keyVersion,
          },
        },
      },
    });
    return { id, accessToken };
  };

  beforeEach(() => {
    fake.calls = [];
    fake.handler = defaultHandler;
    fake.statistics = null;
  });

  beforeAll(async () => {
    app = await buildApp(fake);
    prisma = app.get(PrismaService);
    cipher = app.get(TokenCipherService);
  });

  afterAll(async () => {
    // Borrar usuarios elimina en cascada sus cuentas sociales y credenciales.
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
    await app.close();
  });

  it('sin sesión responde 401', async () => {
    await api().get(`/api/v1/analytics/probe/${randomUUID()}`).expect(401);
  });

  it('resume cada métrica por separado y muestra la que la API rechaza', async () => {
    const user = await login();
    const account = await seedAccount(user.id);

    const res = await probe(user.cookie, account.id, '?days=10').expect(200);
    const { requestedRange, perMetric, combined } = res.body;

    expect(requestedRange.days).toBe(10);
    expect(requestedRange.timeZone).toBe('America/Los_Angeles');
    // Se piden 10 días pero el último con dato queda 2 días atrás: 8 filas, no 10.
    expect(perMetric.views).toEqual({
      statusCode: 200,
      rowCount: 8,
      firstDate: requestedRange.startDate,
      lastDate: addDays(requestedRange.endDate, -2),
      zeroValueRows: 0,
    });
    expect(perMetric.dislikes.statusCode).toBe(400);
    expect(perMetric.dislikes.error).toContain('Unknown metric');
    // La consulta combinada falla porque incluye una métrica rechazada.
    expect(combined.statusCode).toBe(400);
    // 1 consulta combinada + 1 por cada métrica candidata.
    expect(fake.calls).toHaveLength(CANDIDATE_METRICS.length + 1);
  });

  it('con todas las métricas aceptadas, la consulta combinada devuelve columnas y filas', async () => {
    const user = await login();
    const account = await seedAccount(user.id);
    fake.handler = (query) => table(query);

    const res = await probe(user.cookie, account.id, '?days=5').expect(200);

    expect(res.body.combined.statusCode).toBe(200);
    expect(res.body.combined.columns).toEqual(['day', ...CANDIDATE_METRICS]);
    expect(res.body.combined.rows).toHaveLength(3);
    expect(res.body.combined.rows[0][1]).toBe(5);
  });

  it('incluye los totales del canal y nunca devuelve tokens', async () => {
    const user = await login();
    const account = await seedAccount(user.id);
    fake.statistics = {
      viewCount: '12345',
      subscriberCount: '1230',
      videoCount: '7',
      hiddenSubscriberCount: false,
    };

    const res = await probe(user.cookie, account.id).expect(200);

    expect(res.body.channelStatistics).toEqual(fake.statistics);
    expect(JSON.stringify(res.body)).not.toContain(account.accessToken);
  });

  it('oculta secretos en los mensajes de error de Google', async () => {
    const user = await login();
    const account = await seedAccount(user.id);
    fake.handler = () => ({
      statusCode: 403,
      body: { error: { message: 'Falló con Bearer abc.def-ghi y ya29.a0AfB_ejemplo-secreto' } },
    });

    const res = await probe(user.cookie, account.id, '?days=3').expect(200);
    const text = JSON.stringify(res.body);

    expect(res.body.perMetric.views.statusCode).toBe(403);
    expect(text).not.toContain('abc.def-ghi');
    expect(text).not.toContain('ejemplo-secreto');
  });

  it('aislamiento: sondear la cuenta de otro usuario responde 404 y no contacta a Google', async () => {
    const owner = await login();
    const intruder = await login();
    const account = await seedAccount(owner.id);

    await probe(intruder.cookie, account.id).expect(404);
    expect(fake.calls).toHaveLength(0);
  });

  it('rechaza días fuera de rango, no enteros, vacíos, parámetros desconocidos o un ID que no es UUID', async () => {
    const user = await login();
    const account = await seedAccount(user.id);

    for (const query of ['?days=0', '?days=91', '?days=abc', '?days=1.5', '?days=', '?foo=1']) {
      await probe(user.cookie, account.id, query).expect(400);
    }
    await probe(user.cookie, 'no-es-un-uuid').expect(400);
    expect(fake.calls).toHaveLength(0);
  });
});

describe('Sondeo de YouTube Analytics en producción (e2e)', () => {
  const fake = new FakeAnalyticsClient();
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await buildApp(fake, false);
  });

  afterAll(async () => {
    await app.get(PrismaService).user.deleteMany({
      where: { email: { endsWith: TEST_DOMAIN } },
    });
    await app.close();
  });

  it('el endpoint responde 404 y no contacta a Google', async () => {
    const user = await registerAndLogin(app, TEST_DOMAIN);
    await request(app.getHttpServer())
      .get(`/api/v1/analytics/probe/${randomUUID()}`)
      .set('Cookie', user.cookie)
      .expect(404);
    expect(fake.calls).toHaveLength(0);
  });
});