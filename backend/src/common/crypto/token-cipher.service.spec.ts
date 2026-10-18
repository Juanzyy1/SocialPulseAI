import { randomBytes } from 'node:crypto';
import { credentialAad, TokenCipherService } from './token-cipher.service';

const AAD = 'social_credential:cuenta-1:access';
const TOKEN = 'ya29.token-de-prueba-que-no-es-real';
const GENERIC_ERROR = 'No se pudo descifrar el valor';

const newCipher = () => new TokenCipherService(randomBytes(32));

describe('TokenCipherService', () => {
  it('cifra y descifra un token, incluidos unicode y textos largos', () => {
    const cipher = newCipher();
    for (const value of [TOKEN, 'ñandú ✓ 日本語', 'x'.repeat(2000)]) {
      expect(cipher.decrypt(cipher.encrypt(value, AAD), AAD)).toBe(value);
    }
  });

  it('produce cifrados distintos para el mismo texto (IV aleatorio)', () => {
    const cipher = newCipher();
    expect(cipher.encrypt(TOKEN, AAD)).not.toBe(cipher.encrypt(TOKEN, AAD));
  });

  it('el resultado no contiene el texto original y declara la versión de clave', () => {
    const cipher = newCipher();
    const payload = cipher.encrypt(TOKEN, AAD);
    expect(payload).not.toContain(TOKEN);
    expect(payload.startsWith(`${cipher.keyVersion}.`)).toBe(true);
    expect(payload.split('.')).toHaveLength(4);
  });

  it('falla con un AAD distinto (texto cifrado movido a otra fila o campo)', () => {
    const cipher = newCipher();
    const payload = cipher.encrypt(TOKEN, AAD);
    expect(() => cipher.decrypt(payload, 'social_credential:cuenta-2:access')).toThrow(
      GENERIC_ERROR,
    );
  });

  it('falla si se altera el texto cifrado', () => {
    const cipher = newCipher();
    const parts = cipher.encrypt(TOKEN, AAD).split('.');
    const data = Buffer.from(parts[3], 'base64url');
    data[0] ^= 1;
    parts[3] = data.toString('base64url');
    expect(() => cipher.decrypt(parts.join('.'), AAD)).toThrow(GENERIC_ERROR);
  });

  it('falla si se altera la etiqueta de autenticación', () => {
    const cipher = newCipher();
    const parts = cipher.encrypt(TOKEN, AAD).split('.');
    const tag = Buffer.from(parts[2], 'base64url');
    tag[0] ^= 1;
    parts[2] = tag.toString('base64url');
    expect(() => cipher.decrypt(parts.join('.'), AAD)).toThrow(GENERIC_ERROR);
  });

  it('falla con otra clave', () => {
    const payload = newCipher().encrypt(TOKEN, AAD);
    expect(() => newCipher().decrypt(payload, AAD)).toThrow(GENERIC_ERROR);
  });

  it('falla con una versión de clave desconocida', () => {
    const cipher = newCipher();
    const parts = cipher.encrypt(TOKEN, AAD).split('.');
    parts[0] = '2';
    expect(() => cipher.decrypt(parts.join('.'), AAD)).toThrow(GENERIC_ERROR);
  });

  it('falla con formatos inválidos', () => {
    const cipher = newCipher();
    for (const bad of ['', 'x', 'a.b.c', '1.a.b.c', 'a.b.c.d.e']) {
      expect(() => cipher.decrypt(bad, AAD)).toThrow(GENERIC_ERROR);
    }
  });

  it('el mensaje de error es genérico y no revela el token', () => {
    const cipher = newCipher();
    const payload = cipher.encrypt(TOKEN, AAD);
    let message = '';
    try {
      cipher.decrypt(payload, 'otro-aad');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe(GENERIC_ERROR);
    expect(message).not.toContain(TOKEN);
  });

  it('credentialAad distingue la cuenta y el campo', () => {
    expect(credentialAad('a', 'access')).not.toBe(credentialAad('b', 'access'));
    expect(credentialAad('a', 'access')).not.toBe(credentialAad('a', 'refresh'));
  });

  it('rechaza una clave que no mide 32 bytes', () => {
    expect(() => new TokenCipherService(randomBytes(16))).toThrow();
  });
});