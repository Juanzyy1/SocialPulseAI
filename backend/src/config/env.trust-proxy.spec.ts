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

describe('validateEnv: TRUST_PROXY_HOPS', () => {
  it('sin indicar queda undefined: no se asume ningún valor', () => {
    expect(validateEnv(base).TRUST_PROXY_HOPS).toBeUndefined();
    expect(validateEnv({ ...base, TRUST_PROXY_HOPS: '' }).TRUST_PROXY_HOPS).toBeUndefined();
    expect(validateEnv({ ...base, TRUST_PROXY_HOPS: '   ' }).TRUST_PROXY_HOPS).toBeUndefined();
  });

  it.each([
    ['0', 0],
    ['1', 1],
    ['2', 2],
    ['10', 10],
    [' 2 ', 2],
    [1, 1],
    [0, 0],
  ])('acepta %j como %d', (raw, expected) => {
    expect(validateEnv({ ...base, TRUST_PROXY_HOPS: raw }).TRUST_PROXY_HOPS).toBe(expected);
  });

  it.each(['11', '-1', '1.5', 'abc', '1e1', '0x1', 'true', '1 2'])('rechaza %j', (raw) => {
    expect(errorOf({ ...base, TRUST_PROXY_HOPS: raw })).toContain('TRUST_PROXY_HOPS');
  });

  it('un número fuera de rango también se rechaza', () => {
    expect(errorOf({ ...base, TRUST_PROXY_HOPS: 11 })).toContain('TRUST_PROXY_HOPS');
    expect(errorOf({ ...base, TRUST_PROXY_HOPS: -1 })).toContain('TRUST_PROXY_HOPS');
  });

  it('nunca muestra el valor rechazado en el error', () => {
    expect(errorOf({ ...base, TRUST_PROXY_HOPS: 'secreto-9' })).not.toContain('secreto-9');
  });
});