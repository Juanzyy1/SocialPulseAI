import type { AccountStatus } from '../api/types';
import { statusLabel } from '../dashboard/account-status';

const CLASS: Record<AccountStatus, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-300',
  REVOKED: 'bg-amber-400/15 text-amber-300',
  ERROR: 'bg-amber-400/15 text-amber-300',
};

/** El estado va en palabras: el color nunca es la única señal. */
export function StatusBadge({ status }: { status: AccountStatus }) {
  return <span className={`rounded-md px-2 py-0.5 text-xs ${CLASS[status]}`}>{statusLabel(status)}</span>;
}