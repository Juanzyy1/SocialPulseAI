import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  GoogleIdentity,
  GoogleOAuthClient,
} from '../src/auth/google-oauth.client';
import { RATE_LIMIT_CONFIG } from '../src/auth/rate-limit.config';
import { PrismaService } from '../src/prisma/prisma.service';
import { PERMISSIVE_RATE_LIMITS } from './helpers/rate-limits';
import { TERMS } from './helpers/terms';

// Dominio .invalid: reservado, nunca es un correo real.
const TEST_DOMAIN = '@google-test.invalid';
const PASSWORD = 'una-clave-larga-1234';
const VALID_CODE = 'codigo-valido';

/** Cliente de Google simulado: devuelve la identidad que la prueba decida. */
class FakeGoogleClient extends GoogleOAuthClient {
  enabled = true;
  identity: GoogleIdentity | null = null;

  buildAuthUrl(params: { state: string; nonce: string; codeChallenge: string }): string {
    const query = new URLSearchParams({
      state: params.state,
      nonce: params.nonce,
      code_challenge: params.codeChallenge,
    });
    return `https://accounts.google.test/auth?${query.toString()}`;
  }

  async exchangeCode(code: string): Promise<GoogleIdentity> {
    if (code !== VALID_CODE || !this.identity) throw new Error('rechazado');
    return this.identity;
  }
}

async function buildApp(fake: FakeGoogleClient): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(GoogleOAuthClient)
    .useValue(fake)
    .overrideProvider(RATE_LIMIT_CONFIG)
    .useValue(PERMISSIVE_RATE_LIMITS)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

/** Devuelve el Set-Cookie completo de la cookie `name`, o undefined. */
function setCookieOf(res: request.Response, name: string): string | undefined {
  return ([] as string[])
    .concat(res.headers['set-cookie'] ?? [])
    .find((c) => c.startsWith(`${name}=`));
}

const pairOf = (res: request.Response, name: string): string => {
  const raw = setCookieOf(res, name);
  if (!raw) throw new Error(`No llegó la cookie ${name}`);
  return raw.split(';')[0];
};

describe('Google OAuth (e2e, con cliente de Google simulado)', () => {
  const fake = new FakeGoogleClient();
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const api = () => request(app.getHttpServer());
  const newEmail = () => `${randomUUID()}${TEST_DOMAIN}`;
  const newSub = () => `sub-${randomUUID()}`;

  /** Paso 1 del flujo: devuelve el state de la URL y la cookie del flujo. */
  const startFlow = async () => {
    const res = await api().get('/api/v1/auth/google').expect(302);
    const state = new URL(res.headers.location).searchParams.get('state') ?? '';
    return { res, state, cookie: pairOf(res, 'sp_oauth') };
  };

  const callback = (query: string, cookie?: string) => {
    const req = api().get(`/api/v1/auth/google/callback?${query}`);
    return cookie ? req.set('Cookie', cookie) : req;
  };

  /** Recorre el flujo completo con la identidad indicada. */
  const loginWithGoogle = async (identity: GoogleIdentity) => {
    fake.identity = identity;
    const { state, cookie } = await startFlow();
    return callback(`code=${VALID_CODE}&state=${state}`, cookie);
  };

  beforeAll(async () => {
    app = await buildApp(fake);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: TEST_DOMAIN } },
    });
    await app.close();
  });

  it('GET /auth/google redirige a Google con state y deja una cookie de flujo restringida', async () => {
    const { res, state } = await startFlow();
    expect(res.headers.location).toContain('https://accounts.google.test/auth');
    expect(state.length).toBeGreaterThanOrEqual(43);

    const cookie = setCookieOf(res, 'sp_oauth') ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/v1/auth/google');
    expect(cookie).toContain(`sp_oauth=${state}.`);
  });

  it('el callback sin la cookie del flujo responde 400', async () => {
    const { state } = await startFlow();
    await callback(`code=${VALID_CODE}&state=${state}`).expect(400);
  });

  it('el callback con un state distinto responde 400 y borra la cookie del flujo', async () => {
    fake.identity = { sub: newSub(), email: newEmail(), emailVerified: true };
    const { cookie } = await startFlow();
    const res = await callback(`code=${VALID_CODE}&state=otro-state`, cookie).expect(400);

    expect(setCookieOf(res, 'sp_oauth')).toMatch(/sp_oauth=;/);
  });

  it('si Google devuelve un error, responde 401', async () => {
    const { cookie } = await startFlow();
    await callback('error=access_denied', cookie).expect(401);
  });

  it('un código que Google no acepta responde 401 y no crea usuarios', async () => {
    const email = newEmail();
    fake.identity = { sub: newSub(), email, emailVerified: true };
    const { state, cookie } = await startFlow();
    await callback(`code=codigo-falso&state=${state}`, cookie).expect(401);

    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it('regla 3: un correo no verificado por Google responde 401 y no crea usuarios', async () => {
    const email = newEmail();
    await loginWithGoogle({ sub: newSub(), email, emailVerified: false }).then((r) =>
      expect(r.status).toBe(401),
    );
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it('crea un usuario nuevo verificado y sin contraseña, e inicia sesión', async () => {
    const email = newEmail();
    const res = await loginWithGoogle({
      sub: newSub(),
      email,
      emailVerified: true,
      name: 'Ana Pérez',
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/api/v1/users/me');
    expect(setCookieOf(res, 'sp_session')).toContain('HttpOnly');

    const me = await api()
      .get('/api/v1/users/me')
      .set('Cookie', pairOf(res, 'sp_session'))
      .expect(200);
    expect(me.body.email).toBe(email);
    expect(me.body.displayName).toBe('Ana Pérez');
    expect(me.body.emailVerifiedAt).not.toBeNull();

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).toBeNull();
  });

  it('la misma identidad de Google vuelve al mismo usuario sin duplicar nada', async () => {
    const email = newEmail();
    const identity = { sub: newSub(), email, emailVerified: true };
    const first = await loginWithGoogle(identity);
    const second = await loginWithGoogle(identity);

    const idOf = async (res: request.Response) =>
      (await api().get('/api/v1/users/me').set('Cookie', pairOf(res, 'sp_session')).expect(200))
        .body.id;
    expect(await idOf(second)).toBe(await idOf(first));

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { oauthIdentities: true },
    });
    expect(user.oauthIdentities).toHaveLength(1);
  });

  it('el correo de Google se normaliza a minúsculas', async () => {
    const email = newEmail();
    await api().post('/api/v1/auth/register').send({ email, password: PASSWORD, ...TERMS }).expect(201);

    const res = await loginWithGoogle({
      sub: newSub(),
      email: email.toUpperCase(),
      emailVerified: true,
    });
    expect(res.status).toBe(302);
    expect(await prisma.user.count({ where: { email: { endsWith: TEST_DOMAIN } } })).toBeGreaterThan(0);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { oauthIdentities: true },
    });
    expect(user.oauthIdentities).toHaveLength(1);
  });

  it('regla 4: una cuenta local sin verificar pierde su contraseña y sus sesiones', async () => {
    const email = newEmail();
    await api().post('/api/v1/auth/register').send({ email, password: PASSWORD, ...TERMS }).expect(201);
    const attackerLogin = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const oldCookie = pairOf(attackerLogin, 'sp_session');

    const res = await loginWithGoogle({ sub: newSub(), email, emailVerified: true });
    expect(res.status).toBe(302);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { oauthIdentities: true },
    });
    expect(user.passwordHash).toBeNull();
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.oauthIdentities).toHaveLength(1);

    // La sesión anterior y la contraseña antigua ya no sirven.
    await api().get('/api/v1/users/me').set('Cookie', oldCookie).expect(401);
    await api().post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(401);
    // La sesión nueva, la de Google, sí.
    await api().get('/api/v1/users/me').set('Cookie', pairOf(res, 'sp_session')).expect(200);
  });

  it('regla 5: una cuenta local ya verificada conserva su contraseña al vincular Google', async () => {
    const email = newEmail();
    await api().post('/api/v1/auth/register').send({ email, password: PASSWORD, ...TERMS }).expect(201);
    await prisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });

    const res = await loginWithGoogle({ sub: newSub(), email, emailVerified: true });
    expect(res.status).toBe(302);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { oauthIdentities: true },
    });
    expect(user.passwordHash).not.toBeNull();
    expect(user.oauthIdentities).toHaveLength(1);
    await api().post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
  });
});

describe('Google OAuth sin configurar (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const fake = new FakeGoogleClient();
    fake.enabled = false;
    app = await buildApp(fake);
  });
  afterAll(() => app.close());

  it('GET /auth/google y el callback responden 503', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/google').expect(503);
    await request(app.getHttpServer())
      .get('/api/v1/auth/google/callback?code=x&state=y')
      .expect(503);
  });
});