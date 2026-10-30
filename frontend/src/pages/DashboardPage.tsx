import { Link, useSearchParams } from 'react-router';
import { AccountPanel } from '../components/AccountPanel';
import { AccountSelect } from '../components/AccountSelect';
import { AccountsOverview } from '../components/AccountsOverview';
import { PeriodSelector } from '../components/PeriodSelector';
import { pickAccount, withAccount } from '../dashboard/account-params';
import { describeLoadError } from '../dashboard/errors';
import { parsePeriod, withPeriod } from '../dashboard/period-params';
import { useAccounts } from '../dashboard/queries';
import { useSession } from '../session/use-session';

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const session = useSession();
  const accounts = useAccounts();

  const period = parsePeriod(searchParams.get('period'));
  const account = accounts.data ? pickAccount(accounts.data, searchParams.get('account')) : null;
  const name = session.data?.displayName ?? session.data?.email;
  const selectAccount = (id: string) =>
    setSearchParams(withAccount(searchParams, id), { replace: true });

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Panel</h1>
          <p className="text-sm text-panel-muted">Hola, {name}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {accounts.data && account && (
            <AccountSelect accounts={accounts.data} selectedId={account.id} onChange={selectAccount} />
          )}
          <PeriodSelector
            value={period}
            onChange={(next) => setSearchParams(withPeriod(searchParams, next), { replace: true })}
          />
        </div>
      </div>

      {accounts.isPending && (
        <p aria-busy="true" className="text-panel-muted">
          Cargando cuentas…
        </p>
      )}
      {accounts.isError && (
        <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-5 text-sm">
          <p className="text-red-200">{describeLoadError(accounts.error)}</p>
          <button
            type="button"
            onClick={() => void accounts.refetch()}
            className="mt-3 rounded-lg border border-panel-line px-3 py-1.5 text-panel-text hover:bg-panel-line"
          >
            Reintentar
          </button>
        </div>
      )}
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
      {account && <AccountPanel key={account.id} account={account} period={period} />}
      {accounts.data && account && (
        <AccountsOverview accounts={accounts.data} selectedId={account.id} onSelect={selectAccount} />
      )}
    </div>
  );
}