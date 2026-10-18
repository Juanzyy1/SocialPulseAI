import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // tamaño estándar para GCM
const TAG_BYTES = 16;
const KEY_BYTES = 32;
export const CURRENT_KEY_VERSION = 1;

// Mensaje único y genérico: no revela por qué falló ni expone contenido.
const DECRYPT_ERROR = 'No se pudo descifrar el valor';

/**
 * Datos asociados que ligan un cifrado a su fila y campo. Si alguien copia un texto
 * cifrado a otra fila, el descifrado falla porque el contexto ya no coincide.
 */
export const credentialAad = (
  socialAccountId: string,
  field: 'access' | 'refresh',
): string => `social_credential:${socialAccountId}:${field}`;

/**
 * Cifrado autenticado AES-256-GCM. Formato: `versión.iv.etiqueta.datos` (base64url).
 * Solo existe la versión de clave 1; la rotación de claves queda para más adelante.
 */
export class TokenCipherService {
  readonly keyVersion = CURRENT_KEY_VERSION;

  constructor(private readonly key: Buffer) {
    if (key.length !== KEY_BYTES) {
      throw new Error('La clave de cifrado debe tener 32 bytes');
    }
  }

  encrypt(plaintext: string, aad: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      String(this.keyVersion),
      iv.toString('base64url'),
      tag.toString('base64url'),
      data.toString('base64url'),
    ].join('.');
  }

  decrypt(payload: string, aad: string): string {
    const parts = payload.split('.');
    if (parts.length !== 4 || Number(parts[0]) !== this.keyVersion) {
      throw new Error(DECRYPT_ERROR);
    }
    try {
      const iv = Buffer.from(parts[1], 'base64url');
      const tag = Buffer.from(parts[2], 'base64url');
      const data = Buffer.from(parts[3], 'base64url');
      if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
        throw new Error(DECRYPT_ERROR);
      }
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAAD(Buffer.from(aad, 'utf8'));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
      throw new Error(DECRYPT_ERROR);
    }
  }
}