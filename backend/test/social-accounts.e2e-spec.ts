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

// Dominio .invalid: reservado, nunca es un correo real.
const TEST_DOMAIN = '@social-accounts-test.invalid';

/** Cliente simulado: registra los tokens que se le piden revocar. */
class FakeYoutubeClient extends YoutubeOAuthClient {
  enabled = true;
  failRevoke = false;
  revoked: string[] = [];

  buildAuthUrl(): string {
    return '';
  }
  async exchangeCode(): Promise<YoutubeTokens> {
    throw new Error('no se usa en estas pruebas');
  }
  async fetchChannel(): Promise<YoutubeChannel | null> {
    return null;
  }
  async revokeToken(token: string): Promise<void> {
    if (this.failRevoke) throw new Error('fallo simulado de Google');
    this.revoked.push(token);
  }
}

describe('Cuentas sociales (e2e)', () => {
  const fake = new FakeYoutubeClient();
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cipher: TokenCipherService;

  const api = () => request(app.getHttpServer());
  const login = () => registerAndLogin(app, TEST_DOMAIN);

  /** Crea directamente en la base una cuenta de YouTube con credencial cifrada. */
  const seedAccount = async (userId: string) => {
    const id = randomUUID();
    const platformAccountId = `canal-${randomUUID()}`;
    const accessToken = `acceso-${randomUUID()}`;
    const refreshToken = `refresco-${randomUUID()}`;
    await prisma.socialAccount.create({
      data: {
        id,
        userId,
        platform: 'YOUTUBE',
        platformAccountId,
        displayName: 'Canal de prueba',
        credential: {
          create: {
            accessTokenEnc: cipher.encrypt(accessToken, credentialAad(id, 'access')),
            refreshTokenEnc: cipher.encrypt(refreshToken, credentialAad(id, 'refresh')),
            scopes: [...YOUTUBE_SCOPES],
            keyVersion: cipher.keyVersion,
          },
        },
      },
    });
    return { id, platformAccountId, accessToken, refreshToken };
  };

  beforeEach(() => {
    fake.failRevoke = false;
    fake.revoked = [];
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

  it('sin sesión, listar, ver y desconectar responden 401', async () => {
    const id = randomUUID();
    await api().get('/api/v1/social-accounts').expect(401);
    await api().get(`/api/v1/social-accounts/${id}`).expect(401);
    await api().delete(`/api/v1/social-accounts/${id}`).expect(401);
  });

  it('aislamiento: el listado devuelve solo las cuentas propias y nunca credenciales', async () => {
    const a = await login();
    const b = await login();
    const a1 = await seedAccount(a.id);
    const a2 = await seedAccount(a.id);
    const b1 = await seedAccount(b.id);

    const resA = await api().get('/api/v1/social-accounts').set('Cookie', a.cookie).expect(200);
    const resB = await api().get('/api/v1/social-accounts').set('Cookie', b.cookie).expect(200);

    expect(resA.body.map((x: { id: string }) => x.id).sort()).toEqual([a1.id, a2.id].sort());
    expect(resB.body.map((x: { id: string }) => x.id)).toEqual([b1.id]);

    const text = JSON.stringify(resA.body);
    for (const secret of [a1.accessToken, a1.refreshToken, a2.accessToken, a2.refreshToken]) {
      expect(text).not.toContain(secret);
    }
    for (const item of resA.body) {
      expect(item).not.toHaveProperty('credential');
    }
  });

  it('GET /:id devuelve una cuenta propia', async () => {
    const user = await login();
    const account = await seedAccount(user.id);

    const res = await api()
      .get(`/api/v1/social-accounts/${account.id}`)
      .set('Cookie', user.cookie)
      .expect(200);
    expect(res.body.id).toBe(account.id);
    expect(res.body.platformAccountId).toBe(account.platformAccountId);
    expect(res.body).not.toHaveProperty('credential');
  });

  it('aislamiento: ver la cuenta de otro usuario responde 404, igual que un ID inexistente', async () => {
    const a = await login();
    const b = await login();
    const bAccount = await seedAccount(b.id);

    const other = await api()
      .get(`/api/v1/social-accounts/${bAccount.id}`)
      .set('Cookie', a.cookie)
      .expect(404);
    const missing = await api()
      .get(`/api/v1/social-accounts/${randomUUID()}`)
      .set('Cookie', a.cookie)
      .expect(404);

    expect(other.body).toEqual(missing.body);
  });

  it('un ID que no es UUID responde 400', async () => {
    const user = await login();
    await api().get('/api/v1/social-accounts/no-es-un-uuid').set('Cookie', user.cookie).expect(400);
  });

  it('aislamiento: desconectar la cuenta de otro usuario responde 404 y no la toca', async () => {
    const a = await login();
    const b = await login();
    const bAccount = await seedAccount(b.id);

    await api()
      .delete(`/api/v1/social-accounts/${bAccount.id}`)
      .set('Cookie', a.cookie)
      .expect(404);

    expect(await prisma.socialAccount.count({ where: { id: bAccount.id } })).toBe(1);
    expect(await prisma.socialCredential.count({ where: { socialAccountId: bAccount.id } })).toBe(1);
    expect(fake.revoked).toHaveLength(0);
  });

  it('desconectar borra la cuenta y su credencial, revoca el refresh token y libera el canal', async () => {
    const user = await login();
    const account = await seedAccount(user.id);

    const res = await api()
      .delete(`/api/v1/social-accounts/${account.id}`)
      .set('Cookie', user.cookie)
      .expect(200);

    expect(res.body).toEqual({ revokedAtGoogle: true });
    expect(fake.revoked).toEqual([account.refreshToken]);
    expect(await prisma.socialAccount.count({ where: { id: account.id } })).toBe(0);
    expect(await prisma.socialCredential.count({ where: { socialAccountId: account.id } })).toBe(0);
    // El canal queda libre para que otra cuenta (o la misma) lo vuelva a conectar.
    expect(
      await prisma.socialAccount.count({ where: { platformAccountId: account.platformAccountId } }),
    ).toBe(0);
  });

  it('si Google falla al revocar, la cuenta se desconecta igual y se informa', async () => {
    const user = await login();
    const account = await seedAccount(user.id);
    fake.failRevoke = true;

    const res = await api()
      .delete(`/api/v1/social-accounts/${account.id}`)
      .set('Cookie', user.cookie)
      .expect(200);

    expect(res.body).toEqual({ revokedAtGoogle: false });
    expect(await prisma.socialAccount.count({ where: { id: account.id } })).toBe(0);
  });

  it('desconectar dos veces: la segunda responde 404', async () => {
    const user = await login();
    const account = await seedAccount(user.id);

    await api().delete(`/api/v1/social-accounts/${account.id}`).set('Cookie', user.cookie).expect(200);
    await api().delete(`/api/v1/social-accounts/${account.id}`).set('Cookie', user.cookie).expect(404);
  });
});