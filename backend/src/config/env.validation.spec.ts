import { validateEnv } from './env.validation';

const base = { DATABASE_URL: 'postgresql://u:clave@localhost:5432/db' };
const google = {
  GOOGLE_CLIENT_ID: 'id-de-prueba.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'secreto-de-prueba-123',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/v1/auth/google/callback',
};

/** Devuelve el mensaje del error lanzado, o '' si no lanzó nada. */
function errorOf(raw: Record<string, unknown>): string {
  try {
    validateEnv(raw);
    return '';
  } catch (error) {
    return (error as Error).message;
  }
}

describe('validateEnv', () => {
  it('acepta la configuración mínima y aplica los valores por defecto', () => {
    const env = validateEnv(base);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it('rechaza una DATABASE_URL inválida, un PORT fuera de rango y un NODE_ENV desconocido', () => {
    expect(errorOf({ DATABASE_URL: 'esto-no-es-una-url' })).toContain('DATABASE_URL');
    expect(errorOf({ ...base, PORT: '70000' })).toContain('PORT');
    expect(errorOf({ ...base, NODE_ENV: 'staging' })).toContain('NODE_ENV');
  });

  it('acepta la configuración completa de Google', () => {
    const env = validateEnv({ ...base, ...google });
    expect(env.GOOGLE_CLIENT_ID).toBe(google.GOOGLE_CLIENT_ID);
    expect(env.GOOGLE_REDIRECT_URI).toBe(google.GOOGLE_REDIRECT_URI);
  });

  it('rechaza Google incompleto y nombra las variables', () => {
    const message = errorOf({ ...base, GOOGLE_CLIENT_ID: google.GOOGLE_CLIENT_ID });
    expect(message).toContain('Google OAuth está incompleto');
    expect(message).toContain('GOOGLE_CLIENT_SECRET');
  });

  it('nunca muestra valores sensibles en los errores', () => {
    const message = errorOf({
      DATABASE_URL: 'postgresql://u:clave-secreta-999@localhost:5432/db',
      GOOGLE_CLIENT_SECRET: google.GOOGLE_CLIENT_SECRET,
      PORT: 'no-es-un-numero',
    });
    expect(message).not.toBe('');
    expect(message).not.toContain(google.GOOGLE_CLIENT_SECRET);
    expect(message).not.toContain('clave-secreta-999');
  });

  it('rechaza un URI de retorno http fuera de localhost y http en producción', () => {
    const remoteHttp = {
      ...base,
      ...google,
      GOOGLE_REDIRECT_URI: 'http://ejemplo.com/callback',
    };
    expect(errorOf(remoteHttp)).toContain('GOOGLE_REDIRECT_URI');
    expect(errorOf({ ...base, ...google, NODE_ENV: 'production' })).toContain('https');
  });

  it('acepta https en producción', () => {
    const env = validateEnv({
      ...base,
      ...google,
      NODE_ENV: 'production',
      GOOGLE_REDIRECT_URI: 'https://api.ejemplo.com/api/v1/auth/google/callback',
    });
    expect(env.NODE_ENV).toBe('production');
  });
});