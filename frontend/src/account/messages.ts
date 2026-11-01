import { ApiError } from '../api/client';
import type { DisconnectResult, SyncRun } from '../api/types';
import { formatDateRange, plural } from '../dashboard/format';
import type { Notice } from './connect-result';

/** Resultado de una sincronización. El backend responde 200 incluso si falla: hay que mirar `status`. */
export function describeSyncResult(run: SyncRun): Notice {
  switch (run.status) {
    case 'SUCCEEDED':
      return {
        tone: 'success',
        text: `Sincronización completada: ${plural(run.rowsWritten, 'fila guardada', 'filas guardadas')} (${formatDateRange(run.rangeStart, run.rangeEnd)}).`,
      };
    case 'FAILED':
      return {
        tone: 'error',
        text: `La sincronización falló: ${run.errorMessage ?? 'motivo desconocido'}`,
      };
    case 'RUNNING':
      return { tone: 'info', text: 'La sincronización sigue en curso.' };
  }
}

/** Error al pedir la sincronización (lo que impide empezar), no un fallo de la sincronización misma. */
export function describeSyncError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'No se pudo sincronizar. Inténtalo de nuevo.';

  switch (error.status) {
    case 0:
      return 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
    case 400:
      return 'Esta plataforma todavía no se puede sincronizar.';
    case 401:
      return 'Tu sesión caducó. Inicia sesión de nuevo.';
    case 404:
      return 'No encontramos esta cuenta. Puede haberse desconectado.';
    case 409:
      // Dos motivos distintos comparten el 409: acceso revocado, o ya hay una sincronización en curso.
      return error.message.includes('revocado')
        ? 'El acceso a esta cuenta fue revocado o caducó. Reconéctala para poder sincronizar.'
        : 'Ya hay una sincronización en curso para esta cuenta.';
    case 429:
      return 'Sincronizaste hace menos de un minuto. Espera un momento e inténtalo de nuevo.';
    default:
      return 'No se pudo sincronizar. Inténtalo de nuevo.';
  }
}

export function describeDisconnectResult(result: DisconnectResult): Notice {
  return result.revokedAtGoogle
    ? {
        tone: 'success',
        text: 'Cuenta desconectada. Sus credenciales y estadísticas se borraron, y revocamos el acceso en Google.',
      }
    : {
        tone: 'info',
        text: 'Cuenta desconectada y sus datos borrados. No pudimos confirmar la revocación en Google: puedes quitar el acceso desde la configuración de seguridad de tu cuenta de Google.',
      };
}

export function describeDisconnectError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'No se pudo desconectar la cuenta. Inténtalo de nuevo.';

  switch (error.status) {
    case 0:
      return 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
    case 401:
      return 'Tu sesión caducó. Inicia sesión de nuevo.';
    case 404:
      return 'Esta cuenta ya no existe. Actualiza la página.';
    default:
      return 'No se pudo desconectar la cuenta. Inténtalo de nuevo.';
  }
}