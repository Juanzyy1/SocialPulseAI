import type { CookieOptions } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const OAUTH_COOKIE = 'sp_oauth';
const OAUTH_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;
// La cookie solo viaja hacia el callback de Google, no al resto de la API.
const OAUTH_COOKIE_PATH = '/api/v1/auth/google';

export interface OAuthTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
}

const random = (): string => randomBytes(32).toString('base64url');

/** PKCE (RFC 7636), método S256: el desafío es el SHA-256 del verificador. */
export function codeChallengeFor(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

export function createOAuthTransaction(): OAuthTransaction {
  const codeVerifier = random();
  return {
    state: random(),
    nonce: random(),
    codeVerifier,
    codeChallenge: codeChallengeFor(codeVerifier),
  };
}

/** Los tres valores son base64url (sin puntos), así que el punto sirve de separador. */
export function packOAuthCookie(t: OAuthTransaction): string {
  return `${t.state}.${t.nonce}.${t.codeVerifier}`;
}

export function unpackOAuthCookie(
  value: string,
): { state: string; nonce: string; codeVerifier: string } | null {
  const parts = value.split('.');
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) return null;
  const [state, nonce, codeVerifier] = parts;
  return { state, nonce, codeVerifier };
}

/** Comparación en tiempo constante. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function oauthCookieOptions(secure: boolean): CookieOptions {
  // SameSite=Lax: el regreso desde Google es una navegación de nivel superior (GET).
  return { httpOnly: true, sameSite: 'lax', secure, path: OAUTH_COOKIE_PATH };
}

export function oauthCookieSetOptions(secure: boolean): CookieOptions {
  return { ...oauthCookieOptions(secure), maxAge: OAUTH_COOKIE_MAX_AGE_MS };
}