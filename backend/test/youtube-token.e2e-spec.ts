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
  AnalyticsCheck,
  RefreshedToken,
  RefreshTokenRevokedError,
  YOUTUBE_SCOPES,
  YoutubeChannel,
  YoutubeOAuthClient,
  YoutubeTokens,
} from '../src/integrations/youtube/youtube-oauth.client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PERMISSIVE_RATE_LIMITS } from './helpers/rate-limits';
import { registerAndLogin } from './helpers/session';

// Dominio .invalid: reservado, nunca es un correo real.
const TEST_DOMAIN = '@youtube-token-test.invalid';
const HOUR_MS = 3_600_000;

/** Cliente simulado: programable para renovar bien, rechazar el token o fallar la red. */
class FakeYoutubeClient extends YoutubeOAuthClient {
  enabled = true;
  refreshCalls: string[] = [];
  refreshMode: 'ok' | 'revoked' | 'network' = 'ok';
  nextAccessToken = 'acceso-nuevo';
  channelOk = true;
  analytics: AnalyticsCheck = { ok: true, statusCode: 200 };

  buildAuthUrl(): string {
    return '';
  }
  async exchangeCode(): Promise<YoutubeTokens> {
    throw new Error('no se usa en estas pruebas');
  }
  async fetchChannel(): Promise<YoutubeChannel | null> {
    return this.channelOk
      ? { channelId: 'canal', title: null, handle: null, avatarUrl: null }
      : null;
  }
  async revokeToken(): Promise<void> {}
  async refreshAccessToken(refreshToken: string): Promise<RefreshedToken> {
    this.refreshCalls.push(refreshToken);
    if (this.refreshMode === 'revoked') throw new RefreshTokenRevokedError();
    if (this.refreshMode === 'network') throw new Error('red caída simulada');
    return { accessToken: this.nextAccessToken, expiresAt: new Date(Date.now() + HOUR_MS) };
  }
  async checkAnalyticsAccess(): Promise<AnalyticsCheck> {
    return this.analytics;
  }
}

describe('Renovación de tokens y comprobación de YouTube (e2e)', () => {
  const fake = new FakeYoutubeClient();
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cipher: TokenCipherService;

  const api = () => request(app.getHttpServer());
  const login = () => registerAndLogin(app, TEST_DOMAIN);
  const check = (cookie: string, id: string) =>
    api().post(`/api/v1/social-accounts/${id}/check`).set('Cookie', cookie);

  /** Crea una cuenta de YouTube con credencial cifrada que caduca dentro de `expiresInMs`. */
  const seedAccount = async (userId: string, expiresInMs: number) => {
    const id = randomUUID();
    const accessToken = `acceso-${randomUUID()}`;
    const refreshToken = `refresco-${randomUUID()}`;
    await prisma.socialAccount.create({
      data: {
        id,
        userId,
        platform: 'YOUTUBE',
        platformAccountId: `canal-${randomUUID()}`,
        credential: {
          create: {
            accessTokenEnc: cipher.encrypt(accessToken, credentialAad(id, 'access')),
            refreshTokenEnc: cipher.encrypt(refreshToken, credentialAad(id, 'refresh')),
            expiresAt: new Date(Date.now() + expiresInMs),
            scopes: [...YOUTUBE_SCOPES],
            keyVersion: cipher.keyVersion,
          },
        },
      },
    });
    return { id, accessToken, refreshToken };
  };

  const accountRow = (id: string) =>
    prisma.socialAccount.findUniqueOrThrow({
      where: { id },
      include: { credential: true },
    });

  beforeEach(() => {
    fake.refreshCalls = [];
    fake.refreshMode = 'ok';
    fake.nextAccessToken = `acceso-nuevo-${randomUUID()}`;
    fake.channelOk = true;
    fake.analytics = { ok: true, statusCode: 200 };
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(YoutubeOAuthClient)
      .useValue(fake)
      .overrideProvider(RATE_LIMIT_CONFIG)
      .useValue(PERMISSIVE_RATE_LIMITS)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
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

  it('sin sesión, la comprobación responde 401', async () => {
    await api().post(`/api/v1/social-accounts/${randomUUID()}/check`).expect(401);
  });

  it('con un token vigente no se renueva, y la respuesta no contiene tokens', async () => {
    const user = await login();
    const account = await seedAccount(user.id, HOUR_MS);

    const res = await check(user.cookie, account.id).expect(200);

    expect(res.body).toEqual({
      status: 'ACTIVE',
      dataApiAccess: true,
      analyticsAccess: true,
      analyticsStatusCode: 200,
      message: 'Conexión correcta',
    });
    expect(fake.refreshCalls).toHaveLength(0);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(account.accessToken);
    expect(text).not.toContain(account.refreshToken);
  });

  it('con un token caducado se renueva y el nuevo se guarda cifrado', async () => {
    const user = await login();
    const account = await seedAccount(user.id, -1000);
    const before = await accountRow(account.id);

    const res = await check(user.cookie, account.id).expect(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(fake.refreshCalls).toEqual([account.refreshToken]);

    const after = await accountRow(account.id);
    const credential = after.credential;
    if (!credential?.expiresAt) throw new Error('Falta la credencial');
    expect(cipher.decrypt(credential.accessTokenEnc, credentialAad(account.id, 'access'))).toBe(
      fake.nextAccessToken,
    );
    expect(credential.accessTokenEnc).not.toContain(fake.nextAccessToken);
    expect(credential.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(credential.refreshTokenEnc).toBe(before.credential?.refreshTokenEnc);
  });

  it('si Google rechaza el refresh token, la cuenta pasa a REVOKED y se borran sus credenciales', async () => {
    const user = await login();
    const account = await seedAccount(user.id, -1000);
    fake.refreshMode = 'revoked';

    const first = await check(user.cookie, account.id).expect(200);
    expect(first.body.status).toBe('REVOKED');
    expect(first.body.analyticsAccess).toBe(false);
    expect(first.body.message).toContain('conectar');

    const row = await accountRow(account.id);
    expect(row.status).toBe('REVOKED');
    expect(row.credential).toBeNull();

    // Una cuenta revocada no vuelve a contactar a Google.
    const second = await check(user.cookie, account.id).expect(200);
    expect(second.body.status).toBe('REVOKED');
    expect(fake.refreshCalls).toHaveLength(1);
  });

  it('un fallo de red al renovar responde 502 y deja la cuenta intacta', async () => {
    const user = await login();
    const account = await seedAccount(user.id, -1000);
    const before = await accountRow(account.id);
    fake.refreshMode = 'network';

    await check(user.cookie, account.id).expect(502);

    const after = await accountRow(account.id);
    expect(after.status).toBe('ACTIVE');
    expect(after.credential?.accessTokenEnc).toBe(before.credential?.accessTokenEnc);
  });

  it('si YouTube Analytics responde 403, lo informa con una pista y la cuenta sigue activa', async () => {
    const user = await login();
    const account = await seedAccount(user.id, HOUR_MS);
    fake.analytics = { ok: false, statusCode: 403 };

    const res = await check(user.cookie, account.id).expect(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.dataApiAccess).toBe(true);
    expect(res.body.analyticsAccess).toBe(false);
    expect(res.body.analyticsStatusCode).toBe(403);
    expect(res.body.message).toContain('Google Cloud');
  });

  it('aislamiento: comprobar la cuenta de otro usuario responde 404 y no contacta a Google', async () => {
    const owner = await login();
    const intruder = await login();
    const account = await seedAccount(owner.id, -1000);

    await check(intruder.cookie, account.id).expect(404);
    expect(fake.refreshCalls).toHaveLength(0);
    expect((await accountRow(account.id)).status).toBe('ACTIVE');
  });
});