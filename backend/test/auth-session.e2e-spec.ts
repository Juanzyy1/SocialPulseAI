import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { RATE_LIMIT_CONFIG } from '../src/auth/rate-limit.config';
import { PERMISSIVE_RATE_LIMITS } from './helpers/rate-limits';
import { TERMS } from './helpers/terms';

// Dominio .invalid: reservado, nunca es un correo real.
const TEST_DOMAIN = '@session-http-test.invalid';
const PASSWORD = 'una-clave-larga-1234';

describe('Login, logout y guard (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const api = () => request(app.getHttpServer());

  const register = async (): Promise<string> => {
    const email = `${randomUUID()}${TEST_DOMAIN}`;
    await api()
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD, ...TERMS })
      .expect(201);
    return email;
  };

  const login = (email: string, password = PASSWORD) =>
    api().post('/api/v1/auth/login').send({ email, password });

  /** Devuelve el encabezado Set-Cookie completo de la cookie de sesión. */
  const setCookieOf = (res: request.Response): string => {
    const raw = ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('sp_session='));
    if (!raw) throw new Error('No llegó la cookie de sesión');
    return raw;
  };

  /** "sp_session=VALOR" listo para enviar en el encabezado Cookie. */
  const cookiePair = (setCookie: string): string => setCookie.split(';')[0];

  const loginAndGetCookie = async (email: string): Promise<string> =>
    cookiePair(setCookieOf(await login(email).expect(200)));

  const logoutWith = (cookie: string) =>
    api().post('/api/v1/auth/logout').set('Cookie', cookie);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RATE_LIMIT_CONFIG)
      .useValue(PERMISSIVE_RATE_LIMITS)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: TEST_DOMAIN } },
    });
    await app.close();
  });

  it('login correcto fija una cookie HttpOnly con SameSite=Lax y no devuelve datos sensibles', async () => {
    const email = await register();
    const res = await login(email).expect(200);
    const setCookie = setCookieOf(res);

    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(res.body.email).toBe(email);
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('en la base solo queda el hash del token, nunca el token', async () => {
    const email = await register();
    const cookie = await loginAndGetCookie(email);
    const token = cookie.split('=')[1];

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const rows = await prisma.session.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(token);
  });

  it('responde igual con clave errónea y con correo inexistente', async () => {
    const email = await register();
    const wrongPassword = await login(email, 'clave-incorrecta-123').expect(401);
    const unknownUser = await login(`${randomUUID()}${TEST_DOMAIN}`).expect(401);

    expect(wrongPassword.body.message).toBe(unknownUser.body.message);
  });

  it('una cuenta sin contraseña no puede entrar por login', async () => {
    const email = `${randomUUID()}${TEST_DOMAIN}`;
    await prisma.user.create({ data: { email } });
    await login(email).expect(401);
  });

  it('rechaza el login sin contraseña con 400', async () => {
    await api()
      .post('/api/v1/auth/login')
      .send({ email: `${randomUUID()}${TEST_DOMAIN}` })
      .expect(400);
  });

  it('un endpoint privado sin cookie responde 401', async () => {
    await api().post('/api/v1/auth/logout').expect(401);
  });

  it('una cookie con basura responde 401', async () => {
    await logoutWith('sp_session=esto-no-es-un-token-valido').expect(401);
  });

  it('tras el logout, el mismo token ya responde 401', async () => {
    const email = await register();
    const cookie = await loginAndGetCookie(email);

    await logoutWith(cookie).expect(204);
    await logoutWith(cookie).expect(401);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it('logout-all cierra todas las sesiones del usuario y no las de otros', async () => {
    const emailA = await register();
    const emailB = await register();
    const a1 = await loginAndGetCookie(emailA);
    const a2 = await loginAndGetCookie(emailA);
    const b1 = await loginAndGetCookie(emailB);

    await api().post('/api/v1/auth/logout-all').set('Cookie', a1).expect(204);

    await logoutWith(a2).expect(401);
    await logoutWith(b1).expect(204);
  });

  it('una sesión caducada responde 401', async () => {
    const email = await register();
    const cookie = await loginAndGetCookie(email);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await logoutWith(cookie).expect(401);
  });
});