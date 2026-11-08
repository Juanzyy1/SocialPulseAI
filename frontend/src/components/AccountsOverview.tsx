import type { SocialAccount } from '../api/types';
import { accountLabel, platformLabel } from '../dashboard/account-params';
import { describeLastSync } from '../dashboard/account-status';
import { StatusBadge } from './StatusBadge';
import { PlatformIcon } from './PlatformIcon';

interface AccountsOverviewProps {
  accounts: readonly SocialAccount[];
  selectedId: string;
  onSelect: (accountId: string) => void;
}

export function AccountsOverview({ accounts, selectedId, onSelect }: AccountsOverviewProps) {
  return (
    <section aria-labelledby="cuentas-title" className="mt-10">
      <h2 id="cuentas-title" className="mb-3 text-lg font-semibold">
        Tus cuentas
      </h2>
      <ul className="divide-y divide-panel-line rounded-xl border border-panel-line bg-panel-card">
        {accounts.map((account) => {
          const selected = account.id === selectedId;
          return (
            <li key={account.id}>
              <button
                type="button"
                onClick={() => onSelect(account.id)}
                aria-current={selected ? 'true' : undefined}
                className={`flex w-full flex-wrap items-center justify-between gap-2 px-5 py-4 text-left transition-colors hover:bg-panel-line focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600 ${
                  selected ? 'bg-panel-line/60' : ''
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <PlatformIcon platform={account.platform} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{accountLabel(account)}</span>
                    <span className="block text-xs text-panel-muted">
                      {platformLabel(account.platform)} · {describeLastSync(account.lastSyncedAt)}
                    </span>
                  </span>
                </span>
                <StatusBadge status={account.status} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}