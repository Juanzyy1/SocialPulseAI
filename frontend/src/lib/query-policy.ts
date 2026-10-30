import type { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { clearSessionData, SESSION_KEY } from '../session/session-core';

/** Reintenta una vez los fallos de red o del servidor; los errores 4xx no se reintentan. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

/**
 * Un 401 en cualquier consulta de datos significa que la sesión caducó: se limpia la sesión y las
 * guardas de ruta llevan al login. La propia consulta de sesión se ignora (ya trata el 401 como "sin sesión").
 */
export function handleQueryError(
  queryClient: QueryClient,
  error: unknown,
  queryKey: readonly unknown[],
): void {
  if (queryKey[0] === SESSION_KEY[0]) return;
  if (error instanceof ApiError && error.status === 401) clearSessionData(queryClient);
}