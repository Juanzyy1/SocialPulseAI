import { randomBytes } from 'node:crypto';
import { expect, request as pwRequest } from '@playwright/test';

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
/** Solo hace falta si el registro está cerrado por invitación (REGISTRATION_INVITE_CODE). */
export const INVITE_CODE = process.env.E2E_INVITE_CODE ?? '';
export const IS_HTTPS = BASE_URL.startsWith('https://');

export interface TestUser {
  email: string;
  password: string;
  name: string;
}

/** Un usuario nuevo en cada ejecución; el dominio .invalid nunca es un correo real. */
export function newTestUser(): TestUser {
  const id = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  return {
    email: `e2e-${id}@socialpulse-e2e.invalid`,
    password: `E2e-${randomBytes(12).toString('base64url')}-1aA`,
    name: 'Prueba E2E',
  };
}

/** Despierta el servicio: el plan gratuito de Render se duerme tras 15 minutos sin tráfico. */
export async function warmUp(): Promise<void> {
  const context = await pwRequest.newContext({ baseURL: BASE_URL });
  try {
    const response = await context.get('/api/v1/health', { timeout: 150_000 });
    expect(response.ok()).toBe(true);
  } finally {
    await context.dispose();
  }
}

/** Limpieza de último recurso: si una prueba falló a medias, intenta eliminar la cuenta por la API. */
export async function deleteTestUserIfExists(user: TestUser): Promise<void> {
  const context = await pwRequest.newContext({ baseURL: BASE_URL });
  try {
    const login = await context.post('/api/v1/auth/login', {
      data: { email: user.email, password: user.password },
    });
    if (!login.ok()) return; // ya no existe, o nunca se creó
    await context.post('/api/v1/users/me/delete', {
      data: { confirmEmail: user.email, password: user.password },
    });
  } finally {
    await context.dispose();
  }
}