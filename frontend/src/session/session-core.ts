import type { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { usersApi } from '../api/endpoints';
import type { Profile } from '../api/types';

export const SESSION_KEY = ['session'] as const;

/**
 * Perfil de la sesión actual, o null si no hay sesión (el servidor responde 401).
 * Cualquier otro fallo (500, 403, red caída) se relanza: no significa "sin sesión".
 */
export async function fetchSession(): Promise<Profile | null> {
  try {
    return await usersApi.me();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** Deja la sesión en null y borra los datos del resto de consultas: nada de un usuario debe sobrevivirle. */
export function clearSessionData(queryClient: QueryClient): void {
  queryClient.setQueryData(SESSION_KEY, null);
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] });
}