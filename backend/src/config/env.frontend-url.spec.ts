import { validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://u:clave@localhost:5432/db',
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
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

describe('validateEnv: FRONTEND_URL', () => {
  it('es opcional', () => {
    expect(validateEnv(base).FRONTEND_URL).toBeUndefined();
    expect(validateEnv({ ...base, FRONTEND_URL: '   ' }).FRONTEND_URL).toBeUndefined();
  });

  it('acepta http en localhost fuera de producción y devuelve el valor', () => {
    expect(validateEnv({ ...base, FRONTEND_URL: 'http://localhost:5173' }).FRONTEND_URL).toBe(
      'http://localhost:5173',
    );
  });

  it('acepta https en producción', () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.ejemplo.com',
    });
    expect(env.FRONTEND_URL).toBe('https://app.ejemplo.com');
  });

  it('rechaza http en producción', () => {
    expect(
      errorOf({ ...base, NODE_ENV: 'production', FRONTEND_URL: 'http://localhost:5173' }),
    ).toContain('https');
  });

  it('rechaza http fuera de localhost aunque no sea producción', () => {
    expect(errorOf({ ...base, FRONTEND_URL: 'http://app.ejemplo.com' })).toContain('FRONTEND_URL');
  });

  it('rechaza una URL con ruta, parámetros, fragmento o credenciales', () => {
    for (const bad of [
      'http://localhost:5173/panel',
      'http://localhost:5173/?a=1',
      'http://localhost:5173/#x',
      'http://usuario:clave@localhost:5173',
    ]) {
      expect(errorOf({ ...base, FRONTEND_URL: bad })).toContain('solo el origen');
    }
  });

  it('rechaza un texto que no es una URL', () => {
    expect(errorOf({ ...base, FRONTEND_URL: 'esto-no-es-una-url' })).toContain('FRONTEND_URL');
  });

  it('nunca muestra el valor en el error', () => {
    const message = errorOf({
      ...base,
      FRONTEND_URL: 'https://usuario:secreto-777@app.ejemplo.com/ruta',
    });
    expect(message).not.toBe('');
    expect(message).not.toContain('secreto-777');
  });
});