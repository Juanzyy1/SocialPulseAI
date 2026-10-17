import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Hash y verificación de contraseñas con Argon2id.
 * Parámetros: 19 MiB de memoria, 2 iteraciones, 1 hilo. Es el mínimo que recuerdo
 * de la guía de OWASP (no lo he vuelto a verificar en esta sesión): se pueden subir
 * si el servidor lo permite.
 */
@Injectable()
export class PasswordService {
    private readonly options = {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  } as const;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  /** Devuelve false (nunca lanza error) si la clave no coincide o el hash está corrupto. */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}