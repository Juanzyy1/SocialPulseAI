import { ApiError } from '../api/client';

/** Mensaje para el usuario cuando falla la carga de datos del panel. */
export function describeLoadError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'No se pudo contactar con el servidor. Revisa tu conexión.';
    if (error.status === 404) return 'No encontramos esta cuenta. Puede haberse desconectado.';
    if (error.status === 429) return 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
  }
  return 'No se pudieron cargar los datos. Inténtalo de nuevo.';
}