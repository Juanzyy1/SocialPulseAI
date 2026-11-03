import { createHash, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AttemptLimiter } from '../account/attempt-limiter';

export const INVITE_REQUIRED_MESSAGE = 'Se necesita un código de invitación válido';
const TOO_MANY_ATTEMPTS =
  'Demasiados intentos con códigos incorrectos. Espera unos minutos antes de volver a intentarlo';

const sha256 = (text: string): Buffer => createHash('sha256').update(text).digest();

/** Compara en tiempo constante: se comparan los hashes, que siempre tienen la misma longitud. */
export function inviteCodeMatches(expected: string, given: unknown): boolean {
  if (typeof given !== 'string') return false;
  return timingSafeEqual(sha256(expected), sha256(given.trim()));
}

/**
 * Cierra el registro con correo y contraseña por invitación cuando REGISTRATION_INVITE_CODE está definida.
 * Sin ella, el registro está abierto. Los códigos incorrectos se limitan por IP. Va como guarda de la ruta,
 * antes de la validación del cuerpo.
 */
@Injectable()
export class RegistrationGateGuard implements CanActivate {
  private readonly failures = new AttemptLimiter(10, 15 * 60 * 1000);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string | undefined>('REGISTRATION_INVITE_CODE');
    if (!expected) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const key = request.ip ?? 'desconocida';
    if (this.failures.isBlocked(key)) {
      throw new HttpException(TOO_MANY_ATTEMPTS, HttpStatus.TOO_MANY_REQUESTS);
    }

    const body: unknown = request.body;
    const given =
      typeof body === 'object' && body !== null ? (body as { inviteCode?: unknown }).inviteCode : undefined;
    if (inviteCodeMatches(expected, given)) {
      this.failures.reset(key);
      return true;
    }
    this.failures.recordFailure(key);
    throw new ForbiddenException(INVITE_REQUIRED_MESSAGE);
  }
}