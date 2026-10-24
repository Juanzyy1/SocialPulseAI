import { HttpException } from '@nestjs/common';

export type OAuthFailureCode =
  | 'rejected'
  | 'unauthorized'
  | 'already_connected'
  | 'google_error'
  | 'unavailable'
  | 'error';

/**
 * Código corto y fijo para decirle al frontend qué pasó, sin mensajes de Google ni datos de la
 * petición. El frontend traduce cada código a un texto para el usuario.
 */
export function oauthFailureCode(error: unknown): OAuthFailureCode {
  const status = error instanceof HttpException ? error.getStatus() : 500;
  switch (status) {
    case 400:
      return 'rejected';
    case 401:
      return 'unauthorized';
    case 409:
      return 'already_connected';
    case 502:
      return 'google_error';
    case 503:
      return 'unavailable';
    default:
      return 'error';
  }
}