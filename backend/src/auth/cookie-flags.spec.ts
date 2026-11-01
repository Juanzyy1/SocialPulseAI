import { oauthCookieOptions, oauthCookieSetOptions } from './oauth-flow';
import { sessionCookieOptions, sessionCookieSetOptions } from './session-cookie';
import { ytCookieOptions, ytCookieSetOptions } from '../integrations/youtube/youtube-oauth-cookie';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

describe('opciones de las cookies', () => {
  it.each([true, false])('la cookie de sesión sigue la bandera Secure indicada (%s) y es HttpOnly con SameSite=Lax', (secure) => {
    for (const options of [sessionCookieOptions(secure), sessionCookieSetOptions(secure)]) {
      expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', secure, path: '/' });
    }
  });

  it('la cookie de sesión dura 30 días como máximo; el borrado no lleva duración', () => {
    expect(sessionCookieSetOptions(true).maxAge).toBe(30 * DAY);
    expect(sessionCookieOptions(true).maxAge).toBeUndefined();
  });

  it.each([true, false])('las dos cookies temporales de OAuth siguen la bandera Secure (%s), son HttpOnly y Lax', (secure) => {
    for (const options of [
      oauthCookieOptions(secure),
      oauthCookieSetOptions(secure),
      ytCookieOptions(secure),
      ytCookieSetOptions(secure),
    ]) {
      expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', secure });
    }
  });

  it('las cookies temporales de OAuth duran 10 minutos', () => {
    expect(oauthCookieSetOptions(true).maxAge).toBe(10 * MINUTE);
    expect(ytCookieSetOptions(true).maxAge).toBe(10 * MINUTE);
  });
});