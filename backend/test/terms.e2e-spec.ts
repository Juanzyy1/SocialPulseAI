import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { GoogleIdentity, GoogleOAuthClient } from '../src/auth/google-oauth.client';
import { RATE_LIMIT_CONFIG } from '../src/auth/rate-limit.config';
import { CURRENT_TERMS_VERSION } from '../src/legal/terms';
import { PrismaService } from '../src/prisma/prisma.service';
import { PERMISSIVE_RATE_LIMITS } from './helpers/rate-limits';
import { registerAndLogin } from './helpers/session';
import { TERMS } from './helpers/terms';

// Dominio .invalid: reservado, nunca es un correo real.
const TEST_DOMAIN = '@terms-test.invalid';
const PASSWORD = 'una-clave-larga-1234';
const VALID_CODE = 'codigo-valido';

/** Cliente de Google simulado: devuelve la identidad que la prueba decida. */
class FakeGoogleClient extends GoogleOAuthClient {
  enabled = true;
  identity: GoogleIdentity | null = null;

  buildAuthUrl(params: { state: string }): string {
    return `https://accounts.google.test/auth?state=${params.state}`;
  }
  async exchangeCode(code: string): Promise<GoogleIdentity> {
    if (code !== VALID_CODE || !this.identity) throw new Error('rechazado');
    return this.identity;
  }
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

describe('Aceptación de términos (e2e)', () => {
  const google = new FakeGoogleClient();
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const api = () => request(app.getHttpServer());
  const newEmail = () => `${randomUUID()}${TEST_DOMAIN}`;
  const register = (body: object) => api().post('/api/v1/auth/register').send(body);
  const me = (cookie: string) => api().get('/api/v1/users/me').set('Cookie', cookie);
  const accept = (cookie: string, body: object) =>
    api().post('/api/v1/users/me/terms').set('Cookie', cookie).send(body);
  const clearTerms = (id: string) =>
    prisma.user.update({ where: { id }, data: { termsAcceptedAt: null, termsVersion: null } });

  /** Recorre el acceso con Google con la identidad indicada. */
  const loginWithGoogle = async (identity: GoogleIdentity) => {
    google.identity = identity;
    const start = await api().get('/api/v1/auth/google').expect(302);
    const state = new URL(start.headers.location).searchParams.get('state') ?? '';
    return api()
      .get(`/api/v1/auth/google/callback?code=${VALID_CODE}&state=${state}`)
      .set('Cookie', pairOf(start, 'sp_oauth'));
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RATE_LIMIT_CONFIG)
      .useValue(PERMISSIVE_RATE_LIMITS)
      .overrideProvider(GoogleOAuthClient)
      .useValue(google)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
    await app.close();
  });

  it('el registro exige aceptar los términos con la versión vigente', async () => {
    const base = { email: newEmail(), password: PASSWORD };

    for (const body of [
      base,
      { ...base, acceptTerms: true },
      { ...base, termsVersion: CURRENT_TERMS_VERSION },
      { ...base, acceptTerms: false, termsVersion: CURRENT_TERMS_VERSION },
      { ...base, acceptTerms: 'true', termsVersion: CURRENT_TERMS_VERSION },
      { ...base, acceptTerms: true, termsVersion: '2020-01-01' },
    ]) {
      await register(body).expect(400);
    }
    expect(await prisma.user.findUnique({ where: { email: base.email } })).toBeNull();

    const refused = await register({
      ...base,
      acceptTerms: false,
      termsVersion: CURRENT_TERMS_VERSION,
    }).expect(400);
    expect(JSON.stringify(refused.body.message)).toContain('aceptar los términos');

    const outdated = await register({ ...base, acceptTerms: true, termsVersion: '2020-01-01' }).expect(400);
    expect(JSON.stringify(outdated.body.message)).toContain('vigente');
  });

  it('un registro válido guarda la fecha y la versión aceptadas', async () => {
    const email = newEmail();
    const before = Date.now();

    await register({ email, password: PASSWORD, ...TERMS }).expect(201);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.termsVersion).toBe(CURRENT_TERMS_VERSION);
    const acceptedAt = user.termsAcceptedAt?.getTime() ?? 0;
    expect(acceptedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(acceptedAt).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('GET /users/me informa que los términos están al día tras registrarse', async () => {
    const user = await registerAndLogin(app, TEST_DOMAIN);

    const res = await me(user.cookie).expect(200);

    expect(res.body).toMatchObject({
      termsUpToDate: true,
      termsVersion: CURRENT_TERMS_VERSION,
      currentTermsVersion: CURRENT_TERMS_VERSION,
    });
    expect(res.body.termsAcceptedAt).not.toBeNull();
  });

  it('sin aceptación, termsUpToDate es false y el perfil lo indica', async () => {
    const user = await registerAndLogin(app, TEST_DOMAIN);
    await clearTerms(user.id);

    const res = await me(user.cookie).expect(200);

    expect(res.body).toMatchObject({
      termsUpToDate: false,
      termsAcceptedAt: null,
      termsVersion: null,
      currentTermsVersion: CURRENT_TERMS_VERSION,
    });
  });

  it('aceptar registra la versión vigente y repetirlo no cambia la fecha original', async () => {
    const user = await registerAndLogin(app, TEST_DOMAIN);
    await clearTerms(user.id);

    const first = await accept(user.cookie, TERMS).expect(200);
    expect(first.body).toMatchObject({ termsUpToDate: true, termsVersion: CURRENT_TERMS_VERSION });

    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await accept(user.cookie, TERMS).expect(200);

    expect(second.body.termsAcceptedAt).toBe(first.body.termsAcceptedAt);
  });

  it('con una versión antigua aceptada no está al día, y aceptar la vigente la renueva', async () => {
    const user = await registerAndLogin(app, TEST_DOMAIN);
    const oldDate = new Date('2025-01-01T00:00:00Z');
    await prisma.user.update({
      where: { id: user.id },
      data: { termsAcceptedAt: oldDate, termsVersion: '2025-01-01' },
    });

    expect((await me(user.cookie).expect(200)).body.termsUpToDate).toBe(false);

    const res = await accept(user.cookie, TERMS).expect(200);

    expect(res.body.termsVersion).toBe(CURRENT_TERMS_VERSION);
    expect(res.body.termsUpToDate).toBe(true);
    expect(new Date(res.body.termsAcceptedAt).getTime()).toBeGreaterThan(oldDate.getTime());
  });

  it('aceptar con datos inválidos responde 400 y no cambia nada', async () => {
    const user = await registerAndLogin(app, TEST_DOMAIN);
    await clearTerms(user.id);

    for (const body of [
      {},
      { acceptTerms: true },
      { termsVersion: CURRENT_TERMS_VERSION },
      { acceptTerms: false, termsVersion: CURRENT_TERMS_VERSION },
      { acceptTerms: true, termsVersion: '2020-01-01' },
      { ...TERMS, extra: 1 },
    ]) {
      await accept(user.cookie, body).expect(400);
    }

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.termsAcceptedAt).toBeNull();
    expect(row.termsVersion).toBeNull();
  });

  it('sin sesión, aceptar responde 401', async () => {
    await api().post('/api/v1/users/me/terms').send(TERMS).expect(401);
  });

  it('aislamiento: aceptar solo afecta al usuario de la sesión', async () => {
    const a = await registerAndLogin(app, TEST_DOMAIN);
    const b = await registerAndLogin(app, TEST_DOMAIN);
    await clearTerms(a.id);
    await clearTerms(b.id);

    await accept(a.cookie, TERMS).expect(200);

    expect((await me(a.cookie).expect(200)).body.termsUpToDate).toBe(true);
    expect((await me(b.cookie).expect(200)).body.termsUpToDate).toBe(false);
  });

  it('un usuario nuevo de Google no ha aceptado los términos: la puerta de aceptación es necesaria', async () => {
    const res = await loginWithGoogle({
      sub: `sub-${randomUUID()}`,
      email: newEmail(),
      emailVerified: true,
    });
    expect(res.status).toBe(302);

    const profile = await me(pairOf(res, 'sp_session')).expect(200);

    expect(profile.body).toMatchObject({
      termsUpToDate: false,
      termsAcceptedAt: null,
      termsVersion: null,
    });
  });

  it('regla 4: vincular Google a una cuenta pre-registrada sin verificar borra la aceptación de quien la creó', async () => {
    const email = newEmail();
    await register({ email, password: PASSWORD, ...TERMS }).expect(201);

    const res = await loginWithGoogle({ sub: `sub-${randomUUID()}`, email, emailVerified: true });
    expect(res.status).toBe(302);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.termsAcceptedAt).toBeNull();
    expect(user.termsVersion).toBeNull();
    expect((await me(pairOf(res, 'sp_session')).expect(200)).body.termsUpToDate).toBe(false);
  });

  it('regla 5: vincular Google a una cuenta ya verificada conserva su aceptación', async () => {
    const email = newEmail();
    await register({ email, password: PASSWORD, ...TERMS }).expect(201);
    await prisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });

    const res = await loginWithGoogle({ sub: `sub-${randomUUID()}`, email, emailVerified: true });
    expect(res.status).toBe(302);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.termsVersion).toBe(CURRENT_TERMS_VERSION);
    expect(user.termsAcceptedAt).not.toBeNull();
    expect((await me(pairOf(res, 'sp_session')).expect(200)).body.termsUpToDate).toBe(true);
  });
});