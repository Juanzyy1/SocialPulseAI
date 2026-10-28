import { ApiError } from '../api/client';
import type { Profile, TermsAcceptanceInput } from '../api/types';
import { TERMS_VERSION } from './terms';

export type TermsGateMode = 'none' | 'accept' | 'reload';

/**
 * Qué muestra la puerta de aceptación:
 * - none: no hay sesión o ya aceptó la versión vigente;
 * - accept: falta aceptar y el texto de esta página es el vigente;
 * - reload: el backend exige otra versión que la que muestra esta página (aplicación
 *   desactualizada): aceptar no serviría, porque se aceptaría un texto que nadie ha visto.
 */
export function termsGateMode(profile: Profile | null | undefined): TermsGateMode {
  if (!profile || profile.termsUpToDate) return 'none';
  return profile.currentTermsVersion === TERMS_VERSION ? 'accept' : 'reload';
}

/** Siempre se acepta la versión del texto que esta página muestra, no la que informa el backend. */
export function buildTermsAcceptance(): TermsAcceptanceInput {
  return { acceptTerms: true, termsVersion: TERMS_VERSION };
}

/** Mensaje para el usuario cuando falla el registro de la aceptación. */
export function describeTermsError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  if (error.status === 0) {
    return 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  }
  if (error.status === 401) return 'Tu sesión caducó. Inicia sesión de nuevo.';
  if (error.status === 400 && error.message.includes('vigente')) return error.message;
  return 'No se pudo registrar tu aceptación. Inténtalo de nuevo.';
}