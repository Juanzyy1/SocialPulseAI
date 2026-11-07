import type { CookieOptions } from 'express';

export const TIKTOK_OAUTH_COOKIE = 'sp_tt_oauth';
const MAX_AGE_MS = 10 * 60 * 1000;
const PATH = '/api/v1/integrations/tiktok';

export function tiktokCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: PATH };
}

export function tiktokCookieSetOptions(secure: boolean): CookieOptions {
  return { ...tiktokCookieOptions(secure), maxAge: MAX_AGE_MS };
}
