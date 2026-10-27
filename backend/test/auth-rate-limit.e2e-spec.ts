import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RATE_LIMIT_CONFIG } from '../src/auth/rate-limit.config';
import type { RateLimitConfig } from '../src/auth/rate-limit.config';
import { PrismaService } from '../src/prisma/prisma.service';
import { PERMISSIVE_RATE_LIMITS } from './helpers/rate-limits';
import { TERMS } from './helpers/terms';

// Dominio .invalid: reservado, nunca es un correo real.
const TEST_DOMAIN = '@rate-limit-test.invalid';
const PASSWORD = 'una-clave-larga-1234';
const WRONG = 'clave-incorrecta-123';

/** Crea una app con los límites por defecto, o con los que se indiquen. */
async function buildApp(limits?: RateLimitConfig): Promise<INestApplication<App>> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (limits) builder.overrideProvider(RATE_LIMIT_CONFIG).useValue(limits);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

function helpers(app: INestApplication<App>) {
  const api = () => request(app.getHttpServer());
  return {
    register: async (): Promise<string> => {
      const email = `${randomUUID()}${TEST_DOMAIN}`;
      await api().post('/api/v1/auth/register').send({ email, password: PASSWORD, ...TERMS }).expect(201);
      return email;
    },
    login: (email: string, password = PASSWORD) =>
      api().post('/api/v1/auth/login').send({ email, password }),
    registerRaw: () =>
      api()
        .post('/api/v1/auth/register')
        .send({ email: `${randomUUID()}${TEST_DOMAIN}`, password: PASSWORD, ...TERMS }),
  };
}

async function cleanup(app: INestApplication<App>): Promise<void> {
  await app.get(PrismaService).user.deleteMany({
    where: { email: { endsWith: TEST_DOMAIN } },
  });
  await app.close();
}

describe('Límite por IP (configuración por defecto)', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(() => cleanup(app));

  it('tras 5 fallos, el siguiente intento responde 429 aunque la clave sea correcta, también para otros correos', async () => {
    const { register, login } = helpers(app);
    const a = await register();
    const b = await register();

    for (let i = 0; i < 5; i++) await login(a, WRONG).expect(401);

    await login(a).expect(429);
    await login(b).expect(429); // la IP completa queda bloqueada
  });
});

describe('Límite por correo (IP sin límite práctico)', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    app = await buildApp({
      ...PERMISSIVE_RATE_LIMITS,
      loginFailuresPerEmail: { limit: 5, windowMs: 900_000 },
    });
  });
  afterAll(() => cleanup(app));

  it('5 fallos bloquean ese correo, pero no otro desde la misma IP', async () => {
    const { register, login } = helpers(app);
    const a = await register();
    const b = await register();

    for (let i = 0; i < 5; i++) await login(a, WRONG).expect(401);

    await login(a).expect(429);
    await login(b).expect(200);
  });

  it('un login correcto reinicia el contador del correo', async () => {
    const { register, login } = helpers(app);
    const email = await register();

    for (let i = 0; i < 4; i++) await login(email, WRONG).expect(401);
    await login(email).expect(200);
    for (let i = 0; i < 4; i++) await login(email, WRONG).expect(401); // sin 429
  });
});

describe('Límite de registros por IP', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    app = await buildApp({
      ...PERMISSIVE_RATE_LIMITS,
      registrationsPerIp: { limit: 3, windowMs: 3_600_000 },
    });
  });
  afterAll(() => cleanup(app));

  it('el cuarto registro desde la misma IP responde 429', async () => {
    const { registerRaw } = helpers(app);
    for (let i = 0; i < 3; i++) await registerRaw().expect(201);
    await registerRaw().expect(429);
  });
});