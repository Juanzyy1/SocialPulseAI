import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { authApi, usersApi } from '../api/endpoints';
import { buildTermsAcceptance } from '../legal/terms-gate';
import { clearSessionData, fetchSession, SESSION_KEY } from './session-core';

/** Sesión actual: data es el perfil, o null si no hay sesión. */
export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: fetchSession,
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => clearSessionData(queryClient),
    onError: (error) => {
      // Un 401 significa que la sesión ya no existía. Cualquier otro fallo (red, servidor)
      // NO se disimula: la cookie puede seguir viva y la interfaz no debe fingir que cerró.
      if (error instanceof ApiError && error.status === 401) clearSessionData(queryClient);
    },
  });
}

/** Registra la aceptación de los términos y deja el perfil actualizado en la sesión. */
export function useAcceptTerms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => usersApi.acceptTerms(buildTermsAcceptance()),
    onSuccess: (profile) => queryClient.setQueryData(SESSION_KEY, profile),
  });
}