import { Link } from 'react-router';
import { AccountPanel } from '../components/AccountPanel';
import { AccountSelect } from '../components/AccountSelect';
import { AccountsOverview } from '../components/AccountsOverview';
import { LoadError } from '../components/LoadError';
import { PeriodSelector } from '../components/PeriodSelector';
import { pickAccount, withAccount } from '../dashboard/account-params';
import { useAccounts } from '../dashboard/queries';
import { useSelection } from '../dashboard/use-selection';
import { useSession } from '../session/use-session';

export function DashboardPage() {
  const { selection, setSelection, today, searchParams, setSearchParams } = useSelection();
  const session = useSession();
  const accounts = useAccounts();

  const account = accounts.data ? pickAccount(accounts.data, searchParams.get('account')) : null;
  const name = session.data?.displayName ?? session.data?.email;
  const selectAccount = (id: string) =>
    setSearchParams(withAccount(searchParams, id), { replace: true });

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Panel</h1>
          <p className="text-sm text-panel-muted">Hola, {name}</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          {accounts.data && account && (
            <AccountSelect accounts={accounts.data} selectedId={account.id} onChange={selectAccount} />
          )}
          <PeriodSelector selection={selection} today={today} onChange={setSelection} />
        </div>
      </div>

      {accounts.isPending && (
        <p aria-busy="true" className="text-panel-muted">
          Cargando cuentas…
        </p>
      )}
      {accounts.isError && <LoadError error={accounts.error} onRetry={() => void accounts.refetch()} />}
      {accounts.data && account === null && (
        <div className="rounded-xl border border-panel-line bg-panel-card p-6">
          <h2 className="mb-2 text-lg font-semibold">Aún no tienes cuentas conectadas</h2>
          <p className="mb-4 text-panel-muted">
            Conecta tu primera cuenta para ver sus estadísticas en este panel.
          </p>
          <Link to="/cuentas" className="font-medium text-brand-600 underline hover:text-brand-700">
            Ir a Cuentas
          </Link>
        </div>
      )}
      {account && <AccountPanel key={account.id} account={account} selection={selection} />}
      {accounts.data && account && (
        <AccountsOverview accounts={accounts.data} selectedId={account.id} onSelect={selectAccount} />
      )}
    </div>
  );
}