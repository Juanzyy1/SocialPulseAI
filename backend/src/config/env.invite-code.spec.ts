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

describe('validateEnv: REGISTRATION_INVITE_CODE', () => {
  it('es opcional: sin ella el registro queda abierto', () => {
    for (const raw of [undefined, '', '   ']) {
      expect(validateEnv({ ...base, REGISTRATION_INVITE_CODE: raw }).REGISTRATION_INVITE_CODE).toBeUndefined();
    }
  });

  it('acepta un código de 12 o más caracteres y lo recorta', () => {
    expect(validateEnv({ ...base, REGISTRATION_INVITE_CODE: '  abcdefghijkl  ' }).REGISTRATION_INVITE_CODE).toBe(
      'abcdefghijkl',
    );
  });

  it.each(['corto', '12345678901'])('rechaza %j (menos de 12 caracteres) sin mostrar su valor', (raw) => {
    const message = errorOf({ ...base, REGISTRATION_INVITE_CODE: raw });

    expect(message).toContain('REGISTRATION_INVITE_CODE');
    expect(message).not.toContain(raw);
  });
});