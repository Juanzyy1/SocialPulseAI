import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RATE_LIMIT_CONFIG } from '../src/auth/rate-limit.config';
import { PrismaService } from '../src/prisma/prisma.service';
import { PERMISSIVE_RATE_LIMITS } from './helpers/rate-limits';
import { registerAndLogin } from './helpers/session';

// Dominio .invalid: reservado, nunca es un correo real.
const TEST_DOMAIN = '@users-test.invalid';

describe('Perfil de usuario (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const getMe = (cookie: string) =>
    request(app.getHttpServer()).get('/api/v1/users/me').set('Cookie', cookie);
  const patchMe = (cookie: string, body: object) =>
    request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Cookie', cookie)
      .send(body);

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

  it('sin sesión, GET y PATCH responden 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
    await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .send({ displayName: 'Ana' })
      .expect(401);
  });

  it('GET /users/me devuelve el perfil propio sin datos sensibles', async () => {
    const user = await registerAndLogin(app, TEST_DOMAIN);
    const res = await getMe(user.cookie).expect(200);

    expect(res.body.id).toBe(user.id);
    expect(res.body.email).toBe(user.email);
    expect(res.body.emailVerifiedAt).toBeNull();
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('tokenHash');
  });

  it('aislamiento: cada sesión ve únicamente su propio perfil', async () => {
    const a = await registerAndLogin(app, TEST_DOMAIN);
    const b = await registerAndLogin(app, TEST_DOMAIN);

    expect((await getMe(a.cookie).expect(200)).body.email).toBe(a.email);
    expect((await getMe(b.cookie).expect(200)).body.email).toBe(b.email);
  });

  it('PATCH modifica solo al usuario de la sesión', async () => {
    const a = await registerAndLogin(app, TEST_DOMAIN);
    const b = await registerAndLogin(app, TEST_DOMAIN);

    const res = await patchMe(a.cookie, { displayName: 'Ana' }).expect(200);
    expect(res.body.displayName).toBe('Ana');
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('tokenHash');

    expect((await getMe(b.cookie).expect(200)).body.displayName).toBeNull();
    const rowB = await prisma.user.findUniqueOrThrow({ where: { id: b.id } });
    expect(rowB.displayName).toBeNull();
  });

  it('PATCH recorta espacios y convierte un texto vacío en null', async () => {
    const user = await registerAndLogin(app, TEST_DOMAIN);

    const trimmed = await patchMe(user.cookie, { displayName: '  Ana  ' }).expect(200);
    expect(trimmed.body.displayName).toBe('Ana');

    const cleared = await patchMe(user.cookie, { displayName: '   ' }).expect(200);
    expect(cleared.body.displayName).toBeNull();
  });

  it.each([
    ['id', randomUUID()],
    ['email', 'otro@users-test.invalid'],
    ['passwordHash', 'x'],
    ['emailVerifiedAt', '2026-01-01T00:00:00.000Z'],
  ])('PATCH rechaza el campo no editable %s', async (field, value) => {
    const user = await registerAndLogin(app, TEST_DOMAIN);
    await patchMe(user.cookie, { [field]: value }).expect(400);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.emailVerifiedAt).toBeNull();
    expect(row.email).toBe(user.email);
  });

  it('avatarUrl solo acepta URL https', async () => {
    const user = await registerAndLogin(app, TEST_DOMAIN);

    await patchMe(user.cookie, { avatarUrl: 'http://example.com/a.png' }).expect(400);
    await patchMe(user.cookie, { avatarUrl: 'javascript:alert(1)' }).expect(400);

    const ok = await patchMe(user.cookie, {
      avatarUrl: 'https://example.com/a.png',
    }).expect(200);
    expect(ok.body.avatarUrl).toBe('https://example.com/a.png');
  });

  it('rechaza un displayName de más de 80 caracteres', async () => {
    const user = await registerAndLogin(app, TEST_DOMAIN);
    await patchMe(user.cookie, { displayName: 'x'.repeat(81) }).expect(400);
  });

  it('un cuerpo vacío responde 200 y no cambia nada', async () => {
    const user = await registerAndLogin(app, TEST_DOMAIN);
    const res = await patchMe(user.cookie, {}).expect(200);
    expect(res.body.email).toBe(user.email);
  });
});