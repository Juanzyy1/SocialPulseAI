import { validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://u:clave@localhost:5432/db',
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};

function errorOf(raw: Record<string, unknown>): string {
  try {
    validateEnv(raw);
    return '';
  } catch (error) {
    return (error as Error).message;
  }
}

describe('validateEnv: FRONTEND_DIST_DIR y EXPOSE_NETWORK_DIAGNOSTICS', () => {
  it('FRONTEND_DIST_DIR es opcional y se recorta', () => {
    expect(validateEnv(base).FRONTEND_DIST_DIR).toBeUndefined();
    expect(validateEnv({ ...base, FRONTEND_DIST_DIR: '  ' }).FRONTEND_DIST_DIR).toBeUndefined();
    expect(validateEnv({ ...base, FRONTEND_DIST_DIR: ' ../frontend/dist ' }).FRONTEND_DIST_DIR).toBe(
      '../frontend/dist',
    );
  });

  it('los diagnósticos están apagados por defecto', () => {
    expect(validateEnv(base).EXPOSE_NETWORK_DIAGNOSTICS).toBe(false);
    expect(validateEnv({ ...base, EXPOSE_NETWORK_DIAGNOSTICS: '' }).EXPOSE_NETWORK_DIAGNOSTICS).toBe(false);
  });

  it.each([
    ['true', true],
    ['TRUE', true],
    [' true ', true],
    ['false', false],
  ])('acepta %j como %s', (raw, expected) => {
    expect(validateEnv({ ...base, EXPOSE_NETWORK_DIAGNOSTICS: raw }).EXPOSE_NETWORK_DIAGNOSTICS).toBe(expected);
  });

  it.each(['yes', '1', 'verdadero'])('rechaza %j sin mostrar su valor', (raw) => {
    const message = errorOf({ ...base, EXPOSE_NETWORK_DIAGNOSTICS: raw });

    expect(message).toContain('EXPOSE_NETWORK_DIAGNOSTICS');
    expect(message).not.toContain(raw);
  });
});