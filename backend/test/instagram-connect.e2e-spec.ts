import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { InstagramOAuthClient } from '../src/integrations/instagram/instagram-oauth.client';
import { RATE_LIMIT_CONFIG } from '../src/auth/rate-limit.config';
import { credentialAad, TokenCipherService } from '../src/common/crypto/token-cipher.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PERMISSIVE_RATE_LIMITS } from './helpers/rate-limits';
import { registerAndLogin } from './helpers/session';

const TEST_DOMAIN = '@instagram-connect-test.invalid';

class FakeInstagramOAuthClient extends InstagramOAuthClient {
  readonly enabled = true;
  exchangedCodes: string[] = [];

  buildAuthUrl(state: string): string {
    return `https://www.facebook.com/dialog/oauth?state=${state}`;
  }

  async exchangeCode(code: string) {
    this.exchangedCodes.push(code);
    return { accessToken: 'instagram-business-token', expiresAt: null };
  }

  async fetchProfiles() {
    return [{ accountId: 'instagram-account-test', username: 'socialpulse_test' }];
  }
}

describe('Conexión de Instagram (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cipher: TokenCipherService;
  const fake = new FakeInstagramOAuthClient();
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(InstagramOAuthClient)
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
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
    await app.close();
  });

  beforeEach(() => {
    fake.exchangedCodes = [];
  });

  it('el callback desplegado exige sesión y no acepta una autorización sin ella', async () => {
    await api()
      .get('/api/v1/integrations/instagram/callback')
      .query({ code: 'code', state: 'state' })
      .expect(401);
    expect(fake.exchangedCodes).toEqual([]);
  });

  it('inicia el login unificado y conecta con state válido, guardando el token cifrado', async () => {
    const user = await registerAndLogin(app, TEST_DOMAIN);
    const start = await api()
      .get('/api/v1/integrations/instagram/connect')
      .set('Cookie', user.cookie)
      .expect(302);
    const authorizationUrl = new URL(start.headers.location);
    const state = authorizationUrl.searchParams.get('state');
    const oauthCookie = (start.headers['set-cookie'] as string[])
      .find((cookie) => cookie.startsWith('sp_ig_oauth='))
      ?.split(';', 1)[0];

    if (!state || !oauthCookie) throw new Error('Instagram no devolvió la cookie OAuth esperada');
    expect(oauthCookie).toBe(`sp_ig_oauth=${state}`);
    expect(start.headers['set-cookie'].join(';')).toContain('HttpOnly');

    const connected = await api()
      .get('/api/v1/integrations/instagram/callback')
      .query({ code: 'one-use-code', state })
      .set('Cookie', [user.cookie, oauthCookie])
      .expect((response) => {
        if (response.status !== 200 && response.status !== 302) {
          throw new Error(`Esperaba JSON o redirección; recibió ${response.status}`);
        }
      });

    expect(fake.exchangedCodes).toEqual(['one-use-code']);
    if (connected.status === 302) {
      expect(connected.headers.location).toContain('instagram=connected');
    } else {
      expect(connected.body[0].platform).toBe('INSTAGRAM');
    }

    const account = await prisma.socialAccount.findUniqueOrThrow({
      where: {
        platform_platformAccountId: {
          platform: 'INSTAGRAM',
          platformAccountId: 'instagram-account-test',
        },
      },
      include: { credential: true },
    });
    expect(account.userId).toBe(user.id);
    expect(account.handle).toBe('socialpulse_test');
    expect(account.credential?.accessTokenEnc).not.toContain('instagram-business-token');
    expect(
      cipher.decrypt(
        account.credential!.accessTokenEnc,
        credentialAad(account.id, 'access'),
      ),
    ).toBe('instagram-business-token');
    expect(account.credential?.scopes).toEqual(['instagram_basic', 'instagram_manage_insights']);

  });

  it('rechaza state diferente sin intercambiar el código', async () => {
    const user = await registerAndLogin(app, TEST_DOMAIN);
    const cookieValue = 'sp_ig_oauth=estado-correcto';
    await api()
      .get('/api/v1/integrations/instagram/callback')
      .query({ code: 'code', state: 'otro-state' })
      .set('Cookie', [user.cookie, cookieValue])
      .expect(400);
    expect(fake.exchangedCodes).toEqual([]);
  });
});
