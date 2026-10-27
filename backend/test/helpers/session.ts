import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { TERMS } from './terms';

export const TEST_PASSWORD = 'una-clave-larga-1234';

export interface TestUser {
  id: string;
  email: string;
  /** "sp_session=VALOR", listo para el encabezado Cookie. */
  cookie: string;
}

/** Registra un usuario con correo único dentro de `domain`, inicia sesión y devuelve su cookie. */
export async function registerAndLogin(
  app: INestApplication<App>,
  domain: string,
): Promise<TestUser> {
  const email = `${randomUUID()}${domain}`;
  const server = app.getHttpServer();

  const registered = await request(server)
    .post('/api/v1/auth/register')
    .send({ email, password: TEST_PASSWORD, ...TERMS })
    .expect(201);
  const res = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);

  const raw = ([] as string[])
    .concat(res.headers['set-cookie'] ?? [])
    .find((c) => c.startsWith('sp_session='));
  if (!raw) throw new Error('No llegó la cookie de sesión');

  return { id: registered.body.id, email, cookie: raw.split(';')[0] };
}