import { ApiError } from '../api/client';
import type { DeleteAccountInput, DeleteAccountResult, Profile } from '../api/types';
import { plural } from '../dashboard/format';

export interface DeleteForm {
  confirmEmail: string;
  password: string;
}

export type DeleteErrors = Partial<Record<'confirmEmail' | 'password', string>>;

type Identity = Pick<Profile, 'email' | 'hasPassword'>;

/** Devuelve solo los campos con error; un objeto vacío significa que se puede enviar. */
export function deleteFormErrors(form: DeleteForm, profile: Identity): DeleteErrors {
  const errors: DeleteErrors = {};
  if (form.confirmEmail.trim().toLowerCase() !== profile.email.trim().toLowerCase()) {
    errors.confirmEmail = 'Escribe tu correo exactamente como aparece arriba';
  }
  if (profile.hasPassword && form.password === '') {
    errors.password = 'Escribe tu contraseña para confirmar';
  }
  return errors;
}

/** La contraseña solo se envía si la cuenta tiene una, y nunca se recorta. */
export function buildDeleteInput(form: DeleteForm, profile: Identity): DeleteAccountInput {
  return {
    confirmEmail: form.confirmEmail.trim(),
    ...(profile.hasPassword ? { password: form.password } : {}),
  };
}

export function describeDeleteAccountError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Ocurrió un error inesperado. Inténtalo de nuevo.';

  switch (error.status) {
    case 0:
      return 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
    case 401:
      return 'Tu sesión caducó. Inicia sesión de nuevo.';
    case 403:
      return 'Los datos de confirmación no son correctos.';
    case 429:
      return 'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentarlo.';
    default:
      return 'No se pudo eliminar la cuenta. Inténtalo de nuevo.';
  }
}

/** El estado llega por la navegación: se comprueba su forma antes de usarlo. */
export function isDeleteResult(value: unknown): value is DeleteAccountResult {
  if (typeof value !== 'object' || value === null) return false;
  const { accountsDisconnected, revocationsNotConfirmed } = value as Record<string, unknown>;
  return (
    typeof accountsDisconnected === 'number' &&
    typeof revocationsNotConfirmed === 'number' &&
    accountsDisconnected >= 0 &&
    revocationsNotConfirmed >= 0
  );
}

export interface DeletionOutcome {
  text: string;
  /** true si hay algo que el usuario debería hacer por su cuenta (quitar el acceso en Google). */
  warning: boolean;
}

export function describeDeletion(result: DeleteAccountResult | null): DeletionOutcome {
  if (result === null || result.accountsDisconnected === 0) {
    return { text: 'Tu cuenta y todos sus datos se eliminaron.', warning: false };
  }
  if (result.revocationsNotConfirmed === 0) {
    return {
      text: 'Tu cuenta y todos sus datos se eliminaron, y se revocó el acceso a tus canales en Google.',
      warning: false,
    };
  }
  return {
    text: `Tu cuenta y todos sus datos se eliminaron. No pudimos confirmar la revocación del acceso en Google de ${plural(result.revocationsNotConfirmed, 'cuenta', 'cuentas')}: puedes quitarlo desde la configuración de seguridad de tu cuenta de Google.`,
    warning: true,
  };
}