import { useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsApi } from '../api/endpoints';

/**
 * Sincroniza una cuenta. La lista de cuentas se refresca SIEMPRE: una sincronización fallida (HTTP 200
 * con status FAILED) puede haber dejado la cuenta como REVOKED. Las estadísticas solo si salió bien.
 */
export function useSyncAccount(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => accountsApi.sync(accountId),
    onSuccess: (run) => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      if (run.status === 'SUCCEEDED') void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: () => {
      // El estado de la cuenta puede haber cambiado (por ejemplo, ya no existe).
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/** Desconecta una cuenta: sus estadísticas guardadas se borran en el servidor y aquí también. */
export function useDisconnectAccount(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => accountsApi.disconnect(accountId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}