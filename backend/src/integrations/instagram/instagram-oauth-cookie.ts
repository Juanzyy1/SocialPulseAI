import type { CookieOptions } from 'express';

export const IG_OAUTH_COOKIE = 'sp_ig_oauth';
const MAX_AGE_MS = 10 * 60 * 1000;
const PATH = '/api/v1/integrations/instagram';

export function instagramCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: PATH };
}

export function instagramCookieSetOptions(secure: boolean): CookieOptions {
  return { ...instagramCookieOptions(secure), maxAge: MAX_AGE_MS };
}
