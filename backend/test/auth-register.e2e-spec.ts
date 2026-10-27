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
const TEST_DOMAIN = '@register-test.invalid';
const PASSWORD = 'una-clave-larga-1234';

describe('POST /api/v1/auth/register (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const uniqueEmail = () => `${randomUUID()}${TEST_DOMAIN}`;
  const post = (body: object) =>
    request(app.getHttpServer()).post('/api/v1/auth/register').send({ ...TERMS, ...body });

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

  it('registra un usuario y no devuelve datos sensibles', async () => {
    const email = uniqueEmail();
    const res = await post({ email, password: PASSWORD, displayName: 'Ana' }).expect(201);

    expect(res.body.email).toBe(email);
    expect(res.body.displayName).toBe('Ana');
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('password');
  });

  it('guarda la contraseña como hash Argon2id, nunca en claro', async () => {
    const email = uniqueEmail();
    await post({ email, password: PASSWORD }).expect(201);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash?.startsWith('$argon2id$')).toBe(true);
    expect(user.passwordHash).not.toContain(PASSWORD);
    expect(user.emailVerifiedAt).toBeNull();
  });

  it('normaliza el correo a minúsculas', async () => {
    const email = uniqueEmail();
    const res = await post({ email: email.toUpperCase(), password: PASSWORD }).expect(201);
    expect(res.body.email).toBe(email);
  });

  it('rechaza un correo repetido aunque cambien las mayúsculas', async () => {
    const email = uniqueEmail();
    await post({ email, password: PASSWORD }).expect(201);
    await post({ email: email.toUpperCase(), password: PASSWORD }).expect(409);
  });

  it('rechaza una contraseña de menos de 12 caracteres con un mensaje claro', async () => {
    const res = await post({ email: uniqueEmail(), password: 'corta-123' }).expect(400);
    expect(JSON.stringify(res.body.message)).toContain('al menos 12 caracteres');
  });

  it('rechaza un correo con formato inválido', async () => {
    await post({ email: 'esto-no-es-un-correo', password: PASSWORD }).expect(400);
  });

  it('rechaza campos que no existen en el DTO', async () => {
    await post({
      email: uniqueEmail(),
      password: PASSWORD,
      passwordHash: 'x',
    }).expect(400);
  });
});