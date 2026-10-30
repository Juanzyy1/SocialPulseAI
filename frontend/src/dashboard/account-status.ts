import type { AccountStatus } from '../api/types';
import { formatTimestampDate } from './format';

/** Estado de la cuenta en palabras: el color nunca es la única señal. */
export function statusLabel(status: AccountStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'Activa';
    case 'REVOKED':
      return 'Sin acceso';
    case 'ERROR':
      return 'Con error';
  }
}

export function describeLastSync(lastSyncedAt: string | null): string {
  return lastSyncedAt === null
    ? 'Aún sin sincronizar'
    : `Sincronizada el ${formatTimestampDate(lastSyncedAt)}`;
}