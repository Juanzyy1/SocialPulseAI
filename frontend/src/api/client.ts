/** Error de una llamada a la API. status 0 = no hubo respuesta (red caída o servidor apagado). */
export class ApiError extends Error {
  readonly status: number;
  /** Todos los mensajes que envió el backend (la validación puede traer varios). */
  readonly details: string[];

  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

const API_PREFIX = '/api/v1';

/** Extrae los mensajes del formato de error de Nest ({ message: string | string[] }). */
function messagesFrom(payload: unknown): string[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const { message } = payload as { message?: unknown };
  if (typeof message === 'string') return [message];
  if (Array.isArray(message)) {
    return message.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

/** Mensaje en español cuando el backend no envía uno utilizable (por ejemplo, una página HTML de error). */
function genericMessage(status: number): string {
  switch (status) {
    case 400:
      return 'La solicitud no es válida';
    case 401:
      return 'Necesitas iniciar sesión';
    case 403:
      return 'No tienes permiso para hacer esto';
    case 404:
      return 'No se encontró lo que buscas';
    case 429:
      return 'Demasiados intentos; espera un momento';
    case 502:
    case 503:
    case 504:
      return 'El servidor no está disponible';
    case 500:
      return 'Error del servidor';
    default:
      return 'Error inesperado';
  }
}

/**
 * Llamada a la API del mismo origen (en desarrollo, a través del proxy de Vite). Las cookies de
 * sesión viajan solas. Devuelve el JSON, o undefined si el servidor responde 204.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const hasBody = options.body !== undefined;

  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      method: options.method ?? 'GET',
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
      signal: options.signal,
    });
  } catch (error) {
    // Una cancelación es intencional: no se convierte en un error de la API.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'No se pudo contactar con el servidor');
  }

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const details = messagesFrom(payload);
    throw new ApiError(response.status, details[0] ?? genericMessage(response.status), details);
  }
  return payload as T;
}