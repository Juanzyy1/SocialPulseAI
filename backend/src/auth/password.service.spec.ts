import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();
  const password = 'una-clave-de-prueba-larga';

  it('genera un hash Argon2id que no contiene la contraseña', async () => {
    const hash = await service.hash(password);
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain(password);
  });

  it('genera hashes distintos para la misma contraseña (sal aleatoria)', async () => {
    const a = await service.hash(password);
    const b = await service.hash(password);
    expect(a).not.toBe(b);
  });

  it('verifica la contraseña correcta', async () => {
    const hash = await service.hash(password);
    expect(await service.verify(hash, password)).toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const hash = await service.hash(password);
    expect(await service.verify(hash, 'otra-clave-distinta')).toBe(false);
  });

  it('devuelve false con un hash corrupto, sin lanzar error', async () => {
    expect(await service.verify('esto-no-es-un-hash', password)).toBe(false);
  });
});