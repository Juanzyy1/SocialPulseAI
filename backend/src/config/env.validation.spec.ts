import { validateEnv } from './env.validation';

const VALID_KEY = Buffer.alloc(32, 7).toString('base64');
const base = {
  DATABASE_URL: 'postgresql://u:clave@localhost:5432/db',
  TOKEN_ENCRYPTION_KEY: VALID_KEY,
};
const google = {
  GOOGLE_CLIENT_ID: 'id-de-prueba.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'secreto-de-prueba-123',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/v1/auth/google/callback',
};
const instagram = {
  INSTAGRAM_CLIENT_ID: 'instagram-app-id',
  INSTAGRAM_CLIENT_SECRET: 'instagram-app-secret',
  INSTAGRAM_CONFIG_ID: 'instagram-config-id',
  INSTAGRAM_REDIRECT_URI: 'http://localhost:3000/api/v1/integrations/instagram/callback',
};
const tiktok = {
  TIKTOK_CLIENT_KEY: 'tiktok-client-key',
  TIKTOK_CLIENT_SECRET: 'tiktok-client-secret',
  TIKTOK_REDIRECT_URI: 'https://socialpulse.example/api/v1/integrations/tiktok/callback',
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
    expect(env.TOKEN_ENCRYPTION_KEY).toBe(VALID_KEY);
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it('rechaza una DATABASE_URL inválida, un PORT fuera de rango y un NODE_ENV desconocido', () => {
    expect(errorOf({ ...base, DATABASE_URL: 'esto-no-es-una-url' })).toContain('DATABASE_URL');
    expect(errorOf({ ...base, PORT: '70000' })).toContain('PORT');
    expect(errorOf({ ...base, NODE_ENV: 'staging' })).toContain('NODE_ENV');
  });

  it('exige una TOKEN_ENCRYPTION_KEY de 32 bytes en base64', () => {
    const withoutKey = { DATABASE_URL: base.DATABASE_URL };
    const shortKey = Buffer.alloc(16, 7).toString('base64');
    for (const bad of [undefined, '', 'CAMBIA_ESTA_CLAVE', shortKey]) {
      const message = errorOf(
        bad === undefined ? withoutKey : { ...base, TOKEN_ENCRYPTION_KEY: bad },
      );
      expect(message).toContain('TOKEN_ENCRYPTION_KEY');
    }
  });

  it('acepta la configuración completa de Google', () => {
    const env = validateEnv({ ...base, ...google });
    expect(env.GOOGLE_CLIENT_ID).toBe(google.GOOGLE_CLIENT_ID);
    expect(env.GOOGLE_REDIRECT_URI).toBe(google.GOOGLE_REDIRECT_URI);
  });

  it('acepta Instagram OAuth configurado por completo', () => {
    const env = validateEnv({ ...base, ...instagram });
    expect(env.INSTAGRAM_CLIENT_ID).toBe(instagram.INSTAGRAM_CLIENT_ID);
    expect(env.INSTAGRAM_CONFIG_ID).toBe(instagram.INSTAGRAM_CONFIG_ID);
    expect(env.INSTAGRAM_REDIRECT_URI).toBe(instagram.INSTAGRAM_REDIRECT_URI);
  });

  it('acepta TikTok OAuth configurado y permite mantener opcional la integración', () => {
    const env = validateEnv({ ...base, ...tiktok });
    expect(env.TIKTOK_CLIENT_KEY).toBe(tiktok.TIKTOK_CLIENT_KEY);
    expect(env.TIKTOK_REDIRECT_URI).toBe(tiktok.TIKTOK_REDIRECT_URI);
    expect(errorOf({ ...base, TIKTOK_CLIENT_KEY: tiktok.TIKTOK_CLIENT_KEY })).toBe('');
  });

  it('exige un URI HTTPS estático para TikTok incluso en desarrollo', () => {
    expect(
      errorOf({ ...base, ...tiktok, TIKTOK_REDIRECT_URI: `${tiktok.TIKTOK_REDIRECT_URI}?x=1` }),
    ).toContain('TIKTOK_REDIRECT_URI');
    expect(
      errorOf({
        ...base,
        ...tiktok,
        TIKTOK_REDIRECT_URI: 'http://localhost:3000/api/v1/integrations/tiktok/callback',
      }),
    ).toContain('TIKTOK_REDIRECT_URI');
  });

  it('permite Instagram OAuth parcial para que la integración opcional no impida el arranque', () => {
    expect(
      errorOf({ ...base, INSTAGRAM_CLIENT_ID: instagram.INSTAGRAM_CLIENT_ID }),
    ).toBe('');
  });

  it('rechaza un callback inseguro de Instagram aunque la integración sea opcional', () => {
    expect(
      errorOf({
        ...base,
        ...instagram,
        NODE_ENV: 'production',
        INSTAGRAM_REDIRECT_URI: 'http://socialpulse.example/callback',
      }),
    ).toContain('INSTAGRAM_REDIRECT_URI');
  });

  it('rechaza Google incompleto y nombra las variables', () => {
    const message = errorOf({ ...base, GOOGLE_CLIENT_ID: google.GOOGLE_CLIENT_ID });
    expect(message).toContain('Google OAuth está incompleto');
    expect(message).toContain('GOOGLE_CLIENT_SECRET');
  });

  it('nunca muestra valores sensibles en los errores', () => {
    const message = errorOf({
      DATABASE_URL: 'postgresql://u:clave-secreta-999@localhost:5432/db',
      TOKEN_ENCRYPTION_KEY: 'clave-de-cifrado-invalida-777',
      GOOGLE_CLIENT_SECRET: google.GOOGLE_CLIENT_SECRET,
      PORT: 'no-es-un-numero',
    });
    expect(message).not.toBe('');
    expect(message).not.toContain(google.GOOGLE_CLIENT_SECRET);
    expect(message).not.toContain('clave-secreta-999');
    expect(message).not.toContain('clave-de-cifrado-invalida-777');
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