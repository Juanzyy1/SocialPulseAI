import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RATE_LIMIT_CONFIG } from '../src/auth/rate-limit.config';
import {
  credentialAad,
  TokenCipherService,
} from '../src/common/crypto/token-cipher.service';
import {
  YOUTUBE_SCOPES,
  YoutubeChannel,
  YoutubeOAuthClient,
  YoutubeTokens,
} from '../src/integrations/youtube/youtube-oauth.client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PERMISSIVE_RATE_LIMITS } from './helpers/rate-limits';
import { registerAndLogin } from './helpers/session';
import type { TestUser } from './helpers/session';
import { AnalyticsCheck } from '../src/integrations/youtube/youtube-oauth.client';
import { RefreshedToken } from '../src/integrations/youtube/youtube-oauth.client';

// Dominio .invalid: reservado, nunca es un correo real.
const TEST_DOMAIN = '@youtube-test.invalid';
const VALID_CODE = 'codigo-valido';

/** Cliente de YouTube simulado: devuelve lo que la prueba decida. */
class FakeYoutubeClient extends YoutubeOAuthClient {
  enabled = true;
  failExchange = false;
  tokens: YoutubeTokens = { accessToken: 'x', scopes: [] };
  channel: YoutubeChannel | null = null;

  buildAuthUrl(params: { state: string; codeChallenge: string }): string {
    const query = new URLSearchParams({
      state: params.state,
      code_challenge: params.codeChallenge,
    });
    return `https://accounts.google.test/auth?${query.toString()}`;
  }

  async exchangeCode(code: string): Promise<YoutubeTokens> {
    if (this.failExchange || code !== VALID_CODE) throw new Error('rechazado');
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

async function buildApp(fake: FakeYoutubeClient): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(YoutubeOAuthClient)
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

function pairOf(res: request.Response, name: string): string {
  const raw = setCookieOf(res, name);
  if (!raw) throw new Error(`No llegó la cookie ${name}`);
  return raw.split(';')[0];
}

describe('Conexión de YouTube (e2e, con cliente simulado)', () => {
  const fake = new FakeYoutubeClient();
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cipher: TokenCipherService;

  const api = () => request(app.getHttpServer());
  const login = () => registerAndLogin(app, TEST_DOMAIN);

  /** Prepara lo que Google "devolverá": permisos concedidos y tokens nuevos. */
  const grant = (overrides: Partial<YoutubeTokens> = {}): YoutubeTokens => {
    fake.failExchange = false;
    fake.tokens = {
      accessToken: `acceso-${randomUUID()}`,
      refreshToken: `refresco-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 3_600_000),
      scopes: [...YOUTUBE_SCOPES],
      ...overrides,
    };
    return fake.tokens;
  };

  /** Prepara un canal con ID único y lo devuelve. */
  const newChannel = (): string => {
    const channelId = `canal-${randomUUID()}`;
    fake.channel = {
      channelId,
      title: 'Mi canal de prueba',
      handle: '@micanal',
      avatarUrl: 'https://example.com/avatar.png',
    };
    return channelId;
  };

  /** Paso 1: devuelve el state y la cookie del flujo. */
  const connect = async (user: TestUser) => {
    const res = await api()
      .get('/api/v1/integrations/youtube/connect')
      .set('Cookie', user.cookie)
      .expect(302);
    const state = new URL(res.headers.location).searchParams.get('state') ?? '';
    return { res, state, oauthCookie: pairOf(res, 'sp_yt_oauth') };
  };

  const callback = (user: TestUser, query: string, oauthCookie?: string) =>
    api()
      .get(`/api/v1/integrations/youtube/callback?${query}`)
      .set('Cookie', oauthCookie ? `${user.cookie}; ${oauthCookie}` : user.cookie);

  /** Recorre el flujo completo con lo que esté preparado. */
  const fullFlow = async (user: TestUser) => {
    const { state, oauthCookie } = await connect(user);
    return callback(user, `code=${VALID_CODE}&state=${state}`, oauthCookie);
  };

  const accountsOf = (userId: string) =>
    prisma.socialAccount.findMany({
      where: { userId },
      include: { credential: true },
    });

  beforeAll(async () => {
    app = await buildApp(fake);
    prisma = app.get(PrismaService);
    cipher = app.get(TokenCipherService);
  });

  afterAll(async () => {
    // Borrar usuarios elimina en cascada sus cuentas sociales y credenciales.
    await prisma.user.deleteMany({
      where: { email: { endsWith: TEST_DOMAIN } },
    });
    await app.close();
  });

  it('sin sesión, connect y callback responden 401', async () => {
    await api().get('/api/v1/integrations/youtube/connect').expect(401);
    await api().get('/api/v1/integrations/youtube/callback?code=x&state=y').expect(401);
  });

  it('connect redirige a Google con state y deja una cookie de flujo restringida', async () => {
    const user = await login();
    const { res, state } = await connect(user);

    expect(res.headers.location).toContain('https://accounts.google.test/auth');
    expect(state.length).toBeGreaterThanOrEqual(43);

    const cookie = setCookieOf(res, 'sp_yt_oauth') ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/v1/integrations/youtube');
  });

  it('el callback sin la cookie del flujo responde 400', async () => {
    const user = await login();
    const { state } = await connect(user);
    await callback(user, `code=${VALID_CODE}&state=${state}`).expect(400);
  });

  it('un state distinto responde 400 y borra la cookie del flujo', async () => {
    const user = await login();
    const { oauthCookie } = await connect(user);
    const res = await callback(user, `code=${VALID_CODE}&state=otro-state`, oauthCookie).expect(400);

    expect(setCookieOf(res, 'sp_yt_oauth')).toMatch(/sp_yt_oauth=;/);
  });

  it('si el usuario rechaza la autorización en Google, responde 400', async () => {
    const user = await login();
    const { oauthCookie } = await connect(user);
    await callback(user, 'error=access_denied', oauthCookie).expect(400);
  });

  it('conecta el canal: guarda la cuenta, cifra los tokens y no los devuelve', async () => {
    const user = await login();
    const tokens = grant();
    const channelId = newChannel();

    const res = await fullFlow(user).then((r) => {
      expect(r.status).toBe(200);
      return r;
    });

    expect(res.body.platform).toBe('YOUTUBE');
    expect(res.body.platformAccountId).toBe(channelId);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.handle).toBe('@micanal');
    expect(res.body).not.toHaveProperty('credential');
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(tokens.accessToken);
    expect(body).not.toContain(tokens.refreshToken ?? 'no-hay');

    const [account] = await accountsOf(user.id);
    const credential = account.credential;
    if (!credential?.refreshTokenEnc) throw new Error('No se guardó la credencial');

    // En la base no hay texto en claro, y descifra a lo original con su contexto.
    expect(credential.accessTokenEnc).not.toContain(tokens.accessToken);
    expect(credential.refreshTokenEnc).not.toContain(tokens.refreshToken ?? 'no-hay');
    expect(cipher.decrypt(credential.accessTokenEnc, credentialAad(account.id, 'access'))).toBe(
      tokens.accessToken,
    );
    expect(cipher.decrypt(credential.refreshTokenEnc, credentialAad(account.id, 'refresh'))).toBe(
      tokens.refreshToken,
    );
    expect(credential.scopes).toEqual([...YOUTUBE_SCOPES]);
    expect(credential.keyVersion).toBe(cipher.keyVersion);
  });

  it('si falta un permiso (el usuario lo desmarcó), responde 400 y no guarda nada', async () => {
    const user = await login();
    grant({ scopes: [YOUTUBE_SCOPES[0]] });
    newChannel();

    const res = await fullFlow(user);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('yt-analytics.readonly');
    expect(await accountsOf(user.id)).toHaveLength(0);
  });

  it('sin token de actualización responde 400 y no guarda nada', async () => {
    const user = await login();
    grant({ refreshToken: undefined });
    newChannel();

    expect((await fullFlow(user)).status).toBe(400);
    expect(await accountsOf(user.id)).toHaveLength(0);
  });

  it('si la cuenta de Google no tiene canal, responde 400 y no guarda nada', async () => {
    const user = await login();
    grant();
    fake.channel = null;

    const res = await fullFlow(user);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('canal de YouTube');
    expect(await accountsOf(user.id)).toHaveLength(0);
  });

  it('si Google falla al intercambiar el código, responde 502 y no guarda nada', async () => {
    const user = await login();
    grant();
    newChannel();
    fake.failExchange = true;

    expect((await fullFlow(user)).status).toBe(502);
    expect(await accountsOf(user.id)).toHaveLength(0);
  });

  it('un canal ya conectado por otro usuario responde 409 y no cambia de dueño', async () => {
    const owner = await login();
    const intruder = await login();
    grant();
    const channelId = newChannel();

    expect((await fullFlow(owner)).status).toBe(200);
    expect((await fullFlow(intruder)).status).toBe(409);

    const account = await prisma.socialAccount.findUniqueOrThrow({
      where: { platform_platformAccountId: { platform: 'YOUTUBE', platformAccountId: channelId } },
    });
    expect(account.userId).toBe(owner.id);
    expect(await accountsOf(intruder.id)).toHaveLength(0);
  });

  it('el mismo usuario puede reconectar: se actualiza la cuenta y se reemplazan las credenciales', async () => {
    const user = await login();
    grant();
    newChannel();
    const first = await fullFlow(user);
    expect(first.status).toBe(200);

    const renewed = grant();
    const second = await fullFlow(user);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);

    const accounts = await accountsOf(user.id);
    expect(accounts).toHaveLength(1);
    const credential = accounts[0].credential;
    if (!credential) throw new Error('No se guardó la credencial');
    expect(cipher.decrypt(credential.accessTokenEnc, credentialAad(accounts[0].id, 'access'))).toBe(
      renewed.accessToken,
    );
  });

  it('reconectar una cuenta revocada la reactiva con credenciales nuevas', async () => {
    const user = await login();
    grant();
    newChannel();
    const first = await fullFlow(user);
    expect(first.status).toBe(200);

    // Simula lo que hace el sistema cuando Google revoca el acceso.
    await prisma.socialCredential.deleteMany({ where: { socialAccountId: first.body.id } });
    await prisma.socialAccount.update({ where: { id: first.body.id }, data: { status: 'REVOKED' } });

    const renewed = grant();
    const second = await fullFlow(user);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.status).toBe('ACTIVE');

    const [account] = await accountsOf(user.id);
    const credential = account.credential;
    if (!credential) throw new Error('No se guardó la credencial');
    expect(cipher.decrypt(credential.accessTokenEnc, credentialAad(account.id, 'access'))).toBe(
      renewed.accessToken,
    );
  });
});

describe('Conexión de YouTube sin configurar (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const fake = new FakeYoutubeClient();
    fake.enabled = false;
    app = await buildApp(fake);
  });

  afterAll(async () => {
    await app.get(PrismaService).user.deleteMany({
      where: { email: { endsWith: TEST_DOMAIN } },
    });
    await app.close();
  });

  it('connect responde 503', async () => {
    const user = await registerAndLogin(app, TEST_DOMAIN);
    await request(app.getHttpServer())
      .get('/api/v1/integrations/youtube/connect')
      .set('Cookie', user.cookie)
      .expect(503);
  });
});