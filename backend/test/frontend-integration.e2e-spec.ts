import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { GoogleIdentity, GoogleOAuthClient } from '../src/auth/google-oauth.client';
import { RATE_LIMIT_CONFIG } from '../src/auth/rate-limit.config';
import { FRONTEND_ORIGIN } from '../src/frontend/frontend-origin';
import {
  AnalyticsCheck,
  RefreshedToken,
  YOUTUBE_SCOPES,
  YoutubeChannel,
  YoutubeOAuthClient,
  YoutubeTokens,
} from '../src/integrations/youtube/youtube-oauth.client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PERMISSIVE_RATE_LIMITS } from './helpers/rate-limits';
import { registerAndLogin } from './helpers/session';
import type { TestUser } from './helpers/session';
import { TERMS } from './helpers/terms';

// Dominio .invalid: reservado, nunca es un correo real.
const TEST_DOMAIN = '@frontend-integration-test.invalid';
const FRONTEND = 'http://localhost:5173';
const PASSWORD = 'una-clave-larga-1234';
const VALID_CODE = 'codigo-valido';

class FakeGoogleClient extends GoogleOAuthClient {
  enabled = true;
  identity: GoogleIdentity | null = null;

  buildAuthUrl(params: { state: string; nonce: string; codeChallenge: string }): string {
    return `https://accounts.google.test/auth?state=${params.state}`;
  }
  async exchangeCode(code: string): Promise<GoogleIdentity> {
    if (code !== VALID_CODE || !this.identity) throw new Error('rechazado');
    return this.identity;
  }
}

class FakeYoutubeClient extends YoutubeOAuthClient {
  enabled = true;
  tokens: YoutubeTokens = { accessToken: 'x', scopes: [] };
  channel: YoutubeChannel | null = null;

  buildAuthUrl(params: { state: string; codeChallenge: string }): string {
    return `https://accounts.google.test/auth?state=${params.state}`;
  }
  async exchangeCode(code: string): Promise<YoutubeTokens> {
    if (code !== VALID_CODE) throw new Error('rechazado');
    return this.tokens;
  }
  async fetchChannel(): Promise<YoutubeChannel | null> {
    return this.channel;
  }
  async revokeToken(): Promise<void> {}
  async refreshAccessToken(): Promise<RefreshedToken> {
    throw new Error('no se usa en estas pruebas');
  }
  async checkAnalyticsAccess(): Promise<AnalyticsCheck> {
    return { ok: true, statusCode: 200 };
  }
}

async function buildApp(
  frontendOrigin: string | null,
  google = new FakeGoogleClient(),
  youtube = new FakeYoutubeClient(),
): Promise<INestApplication<App>> {
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RATE_LIMIT_CONFIG)
    .useValue(PERMISSIVE_RATE_LIMITS)
    .overrideProvider(GoogleOAuthClient)
    .useValue(google)
    .overrideProvider(YoutubeOAuthClient)
    .useValue(youtube);
  // Sin sustitución, el origen sale del entorno, que test/setup-env.ts deja vacío (sin frontend).
  if (frontendOrigin) builder.overrideProvider(FRONTEND_ORIGIN).useValue(frontendOrigin);

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

async function cleanup(app: INestApplication<App>): Promise<void> {
  await app.get(PrismaService).user.deleteMany({
    where: { email: { endsWith: TEST_DOMAIN } },
  });
  await app.close();
}

/** Devuelve el Set-Cookie completo de la cookie `name`, o undefined. */
function setCookieOf(res: request.Response, name: string): string | undefined {
  return ([] as string[])
    .concat(res.headers['set-cookie'] ?? [])
    .find((c) => c.startsWith(`${name}=`));
}

function pairOf(res: request.Response, name: string): string {
  const raw = setCookieOf(res, name);
  if (!raw) throw new Error(`No llegó la cookie ${name}`);
  return raw.split(';')[0];
}

describe('Validación de Origin (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const api = () => request(app.getHttpServer());
  const newEmail = () => `${randomUUID()}${TEST_DOMAIN}`;

  beforeAll(async () => {
    app = await buildApp(FRONTEND);
    prisma = app.get(PrismaService);
  });
  afterAll(() => cleanup(app));

  it('un origen ajeno recibe 403 y la petición no llega a ejecutarse', async () => {
    const email = newEmail();
    const res = await api()
      .post('/api/v1/auth/register')
      .set('Origin', 'http://evil.example')
      .send({ email, password: PASSWORD })
      .expect(403);

    expect(res.body).toEqual({ statusCode: 403, message: 'Origen no permitido', error: 'Forbidden' });
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it('Origin "null" recibe 403', async () => {
    await api()
      .post('/api/v1/auth/login')
      .set('Origin', 'null')
      .send({ email: newEmail(), password: PASSWORD, ...TERMS })
      .expect(403);
  });

  it('el origen del frontend configurado se acepta', async () => {
    await api()
      .post('/api/v1/auth/register')
      .set('Origin', FRONTEND)
      .send({ email: newEmail(), password: PASSWORD, ...TERMS })
      .expect(201);
  });

  it('una petición GET con origen ajeno se permite', async () => {
    await api().get('/api/v1/health').set('Origin', 'http://evil.example').expect(200);
  });
});

describe('Validación de Origin sin frontend configurado (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await buildApp(null);
  });
  afterAll(() => cleanup(app));

  it('el origen del frontend tampoco se acepta si no está configurado', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', FRONTEND)
      .send({ email: `${randomUUID()}${TEST_DOMAIN}`, password: PASSWORD })
      .expect(403);
  });
});

describe('Redirecciones al frontend (e2e)', () => {
  const google = new FakeGoogleClient();
  const youtube = new FakeYoutubeClient();
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const api = () => request(app.getHttpServer());
  const login = () => registerAndLogin(app, TEST_DOMAIN);

  const startGoogle = async () => {
    const res = await api().get('/api/v1/auth/google').expect(302);
    const state = new URL(res.headers.location).searchParams.get('state') ?? '';
    return { state, cookie: pairOf(res, 'sp_oauth') };
  };
  const googleCallback = (query: string, cookie: string) =>
    api().get(`/api/v1/auth/google/callback?${query}`).set('Cookie', cookie);

  /** Prepara lo que Google "devolverá" para YouTube y un canal con ID único. */
  const prepareYoutube = (scopes: string[] = [...YOUTUBE_SCOPES]) => {
    youtube.tokens = {
      accessToken: `acceso-${randomUUID()}`,
      refreshToken: `refresco-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 3_600_000),
      scopes,
    };
    youtube.channel = {
      channelId: `canal-${randomUUID()}`,
      title: 'Mi canal',
      handle: '@micanal',
      avatarUrl: null,
    };
  };
  const connectYoutube = async (user: TestUser) => {
    const start = await api()
      .get('/api/v1/integrations/youtube/connect')
      .set('Cookie', user.cookie)
      .expect(302);
    const state = new URL(start.headers.location).searchParams.get('state') ?? '';
    return api()
      .get(`/api/v1/integrations/youtube/callback?code=${VALID_CODE}&state=${state}`)
      .set('Cookie', `${user.cookie}; ${pairOf(start, 'sp_yt_oauth')}`);
  };

  beforeAll(async () => {
    app = await buildApp(FRONTEND, google, youtube);
    prisma = app.get(PrismaService);
  });
  afterAll(() => cleanup(app));

  it('Google: un acceso correcto redirige a la raíz del frontend y fija la sesión', async () => {
    google.identity = { sub: `sub-${randomUUID()}`, email: `${randomUUID()}${TEST_DOMAIN}`, emailVerified: true };
    const { state, cookie } = await startGoogle();

    const res = await googleCallback(`code=${VALID_CODE}&state=${state}`, cookie);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${FRONTEND}/`);
    expect(setCookieOf(res, 'sp_session')).toContain('HttpOnly');
  });

  it('Google: los fallos redirigen a /login con un código, sin sesión y sin detalles', async () => {
    const { cookie } = await startGoogle();

    const badState = await googleCallback(`code=${VALID_CODE}&state=otro-state`, cookie);
    expect(badState.status).toBe(302);
    expect(badState.headers.location).toBe(`${FRONTEND}/login?error=rejected`);
    expect(setCookieOf(badState, 'sp_session')).toBeUndefined();

    const denied = await googleCallback('error=access_denied', cookie);
    expect(denied.status).toBe(302);
    expect(denied.headers.location).toBe(`${FRONTEND}/login?error=unauthorized`);
    expect(setCookieOf(denied, 'sp_session')).toBeUndefined();
  });

  it('YouTube: una conexión correcta redirige a /cuentas?youtube=connected', async () => {
    const user = await login();
    prepareYoutube();

    const res = await connectYoutube(user);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${FRONTEND}/cuentas?youtube=connected`);
    expect(await prisma.socialAccount.count({ where: { userId: user.id } })).toBe(1);
  });

  it('YouTube: un fallo redirige con un código y no guarda nada', async () => {
    const user = await login();
    prepareYoutube([YOUTUBE_SCOPES[0]]); // falta un permiso obligatorio

    const res = await connectYoutube(user);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${FRONTEND}/cuentas?youtube=error&reason=rejected`);
    expect(await prisma.socialAccount.count({ where: { userId: user.id } })).toBe(0);
  });

  it('YouTube: un canal ya conectado por otro usuario redirige con already_connected', async () => {
    const owner = await login();
    const intruder = await login();
    prepareYoutube();

    expect((await connectYoutube(owner)).headers.location).toBe(
      `${FRONTEND}/cuentas?youtube=connected`,
    );
    const res = await connectYoutube(intruder);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${FRONTEND}/cuentas?youtube=error&reason=already_connected`);
    expect(await prisma.socialAccount.count({ where: { userId: intruder.id } })).toBe(0);
  });
});