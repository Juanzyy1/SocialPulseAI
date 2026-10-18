import type { CookieOptions } from 'express';

export const YT_OAUTH_COOKIE = 'sp_yt_oauth';
const MAX_AGE_MS = 10 * 60 * 1000;
// La cookie solo viaja hacia las rutas de esta integración.
const PATH = '/api/v1/integrations/youtube';

export function ytCookieOptions(secure: boolean): CookieOptions {
  // SameSite=Lax: el regreso desde Google es una navegación de nivel superior (GET).
  return { httpOnly: true, sameSite: 'lax', secure, path: PATH };
}

export function ytCookieSetOptions(secure: boolean): CookieOptions {
  return { ...ytCookieOptions(secure), maxAge: MAX_AGE_MS };
}