import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { dailyMetricCodes } from '../src/analytics/metric-catalog';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RATE_LIMIT_CONFIG } from '../src/auth/rate-limit.config';
import { SessionsService } from '../src/auth/sessions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PERMISSIVE_RATE_LIMITS } from './helpers/rate-limits';
import { registerAndLogin, TEST_PASSWORD } from './helpers/session';

// Dominio .invalid: reservado, nunca es un correo real.
const TEST_DOMAIN = '@account-deletion-test.invalid';

describe('Eliminación de cuenta (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessions: SessionsService;

  const api = () => request(app.getHttpServer());
  const login = () => registerAndLogin(app, TEST_DOMAIN);
  const del = (cookie: string, body: object) =>
    api().post('/api/v1/users/me/delete').set('Cookie', cookie).send(body);
  const me = (cookie: string) => api().get('/api/v1/users/me').set('Cookie', cookie);
  const userExists = async (id: string) => (await prisma.user.count({ where: { id } })) === 1;

  /** Una cuenta que solo entra con Google: sin contraseña. */
  const googleOnlyUser = async () => {
    const email = `${randomUUID()}${TEST_DOMAIN}`;
    const user = await prisma.user.create({ data: { email, emailVerifiedAt: new Date() } });
    const session = await sessions.create(user.id);
    return { id: user.id, email, cookie: `sp_session=${session.token}` };
  };

  const seedAccountWithMetrics = async (userId: string) => {
    const account = await prisma.socialAccount.create({
      data: { userId, platform: 'YOUTUBE', platformAccountId: `canal-${randomUUID()}` },
    });
    await prisma.accountDailyMetric.createMany({
      data: dailyMetricCodes('YOUTUBE').map((metric) => ({
        socialAccountId: account.id,
        metricDate: new Date('2026-10-10T00:00:00Z'),
        metric,
        value: 1,
      })),
    });
    return account.id;
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
    sessions = app.get(SessionsService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
    await app.close();
  });

  it('sin sesión responde 401', async () => {
    await api().post('/api/v1/users/me/delete').send({ confirmEmail: 'a@b.co' }).expect(401);
  });

  it('rechaza con 400 los datos inválidos y no elimina nada', async () => {
    const user = await login();

    for (const body of [
      {},
      { confirmEmail: '' },
      { confirmEmail: 123 },
      { confirmEmail: user.email, extra: 1 },
      { confirmEmail: user.email, password: 'x'.repeat(129) },
    ]) {
      await del(user.cookie, body).expect(400);
    }
    expect(await userExists(user.id)).toBe(true);
  });

  it('un correo que no coincide, o una contraseña ausente o incorrecta, responde 403 y no elimina nada', async () => {
    const user = await login();

    for (const body of [
      { confirmEmail: `otro${TEST_DOMAIN}`, password: TEST_PASSWORD },
      { confirmEmail: user.email },
      { confirmEmail: user.email, password: 'una-clave-incorrecta-99' },
      { confirmEmail: `otro${TEST_DOMAIN}` },
    ]) {
      const res = await del(user.cookie, body).expect(403);
      // Un único mensaje: no se revela cuál de los datos falló.
      expect(res.body.message).toBe('Los datos de confirmación no son correctos');
    }
    expect(await userExists(user.id)).toBe(true);
    await me(user.cookie).expect(200);
  });

  it('con los datos correctos elimina la cuenta, sus canales, sus estadísticas y sus sesiones', async () => {
    const user = await login();
    const accountId = await seedAccountWithMetrics(user.id);

    const res = await del(user.cookie, { confirmEmail: user.email, password: TEST_PASSWORD }).expect(200);

    // La cuenta sin credencial no tiene nada que revocar en Google: se cuenta como "no confirmada".
    expect(res.body).toEqual({ accountsDisconnected: 1, revocationsNotConfirmed: 1 });
    expect(await userExists(user.id)).toBe(false);
    expect(await prisma.socialAccount.count({ where: { id: accountId } })).toBe(0);
    expect(await prisma.accountDailyMetric.count({ where: { socialAccountId: accountId } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);

    const cleared = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cleared.some((c) => c.startsWith('sp_session=;') && c.includes('1970'))).toBe(true);
    await me(user.cookie).expect(401);
  });

  it('el correo se acepta sin distinguir mayúsculas ni espacios', async () => {
    const user = await login();

    await del(user.cookie, {
      confirmEmail: `  ${user.email.toUpperCase()}  `,
      password: TEST_PASSWORD,
    }).expect(200);

    expect(await userExists(user.id)).toBe(false);
  });

  it('una cuenta sin contraseña (solo Google) se elimina con el correo; el perfil lo indica con hasPassword', async () => {
    const withPassword = await login();
    const googleOnly = await googleOnlyUser();

    expect((await me(withPassword.cookie).expect(200)).body.hasPassword).toBe(true);
    expect((await me(googleOnly.cookie).expect(200)).body.hasPassword).toBe(false);

    await del(googleOnly.cookie, { confirmEmail: googleOnly.email }).expect(200);

    expect(await userExists(googleOnly.id)).toBe(false);
  });

  it('aislamiento: eliminar una cuenta no afecta a otra', async () => {
    const a = await login();
    const b = await login();
    const accountOfB = await seedAccountWithMetrics(b.id);

    await del(a.cookie, { confirmEmail: a.email, password: TEST_PASSWORD }).expect(200);

    await me(b.cookie).expect(200);
    expect(await prisma.socialAccount.count({ where: { id: accountOfB } })).toBe(1);
    expect(await prisma.accountDailyMetric.count({ where: { socialAccountId: accountOfB } })).toBeGreaterThan(0);
  });

  it('tras 5 confirmaciones fallidas responde 429, incluso con los datos correctos, y no elimina nada', async () => {
    const user = await login();
    for (let i = 0; i < 5; i++) {
      await del(user.cookie, { confirmEmail: user.email, password: `incorrecta-${i}-xxxxxx` }).expect(403);
    }

    const blocked = await del(user.cookie, { confirmEmail: user.email, password: TEST_PASSWORD }).expect(429);

    expect(blocked.body.message).toContain('Demasiados intentos');
    expect(await userExists(user.id)).toBe(true);
  });

  it('los fallos de un usuario no bloquean a otro', async () => {
    const a = await login();
    const b = await login();
    for (let i = 0; i < 5; i++) {
      await del(a.cookie, { confirmEmail: a.email, password: `incorrecta-${i}-xxxxxx` }).expect(403);
    }

    await del(b.cookie, { confirmEmail: b.email, password: TEST_PASSWORD }).expect(200);

    expect(await userExists(b.id)).toBe(false);
  });
});