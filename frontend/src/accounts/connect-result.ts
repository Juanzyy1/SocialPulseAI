/** Ruta del backend que inicia la conexión de un canal. Se abre como enlace normal, no con fetch. */
export const YOUTUBE_CONNECT_URL = '/api/v1/integrations/youtube/connect';

// Códigos que el backend puede enviar en ?reason=. Cualquier otro valor es un texto de la URL,
// que puede escribir cualquiera, y nunca se muestra tal cual.
const KNOWN_REASONS = [
  'rejected',
  'unauthorized',
  'already_connected',
  'google_error',
  'unavailable',
  'error',
] as const;

export type ConnectReason = (typeof KNOWN_REASONS)[number];

export type ConnectOutcome = { kind: 'connected' } | { kind: 'error'; reason: ConnectReason };

/** Resultado de la conexión según los parámetros de la URL, o null si no hay ninguno. */
export function parseConnectResult(params: URLSearchParams): ConnectOutcome | null {
  const status = params.get('youtube');
  if (status === 'connected') return { kind: 'connected' };
  if (status === 'error') {
    const reason = params.get('reason');
    return { kind: 'error', reason: KNOWN_REASONS.find((known) => known === reason) ?? 'error' };
  }
  return null;
}

/** Copia de los parámetros sin los del resultado de la conexión. No modifica el original. */
export function withoutConnectResult(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete('youtube');
  next.delete('reason');
  return next;
}

export interface Notice {
  tone: 'success' | 'error' | 'info';
  text: string;
}

const REASON_MESSAGES: Record<ConnectReason, string> = {
  rejected:
    'No se completó la conexión. Puede que la hayas cancelado, que no hayas concedido los dos permisos solicitados o que la cuenta de Google no tenga un canal de YouTube. Vuelve a intentarlo y acepta los dos permisos.',
  unauthorized: 'Tu sesión caducó. Inicia sesión de nuevo e inténtalo otra vez.',
  already_connected: 'Ese canal ya está conectado a otra cuenta de SocialPulse AI.',
  google_error:
    'Hubo un problema al comunicarse con Google o con YouTube. Inténtalo de nuevo en unos minutos.',
  unavailable: 'La conexión con YouTube no está disponible en este momento.',
  error: 'No se pudo conectar el canal. Inténtalo de nuevo.',
};

export function describeConnectResult(outcome: ConnectOutcome): Notice {
  if (outcome.kind === 'connected') {
    return {
      tone: 'success',
      text: 'Canal conectado. Ahora sincroniza la cuenta para traer sus estadísticas.',
    };
  }
  return { tone: 'error', text: REASON_MESSAGES[outcome.reason] };
}