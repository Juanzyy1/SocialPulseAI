import { useId } from 'react';
import type { SocialAccount } from '../api/types';
import { accountLabel } from '../dashboard/account-params';

interface AccountSelectProps {
  accounts: readonly SocialAccount[];
  selectedId: string;
  onChange: (accountId: string) => void;
}

/** Solo aparece con dos o más cuentas; con una, el nombre se muestra en el panel. */
export function AccountSelect({ accounts, selectedId, onChange }: AccountSelectProps) {
  const id = useId();
  if (accounts.length < 2) return null;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-panel-muted">
        Cuenta
      </label>
      <select
        id={id}
        value={selectedId}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-panel-line bg-panel-card px-3 py-2 text-sm text-panel-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {accountLabel(account)}
            {account.status !== 'ACTIVE' ? ' (sin acceso)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}