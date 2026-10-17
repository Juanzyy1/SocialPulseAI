import type { CookieOptions } from 'express';

export const SESSION_COOKIE = 'sp_session';

// Límite absoluto de la sesión (30 días). La caducidad por inactividad la aplica el servidor.
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Atributos de seguridad de la cookie. `secure` solo en producción (HTTPS). */
export function sessionCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: '/' };
}

export function sessionCookieSetOptions(secure: boolean): CookieOptions {
  return { ...sessionCookieOptions(secure), maxAge: COOKIE_MAX_AGE_MS };
}