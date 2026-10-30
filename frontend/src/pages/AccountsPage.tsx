import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  describeConnectResult,
  parseConnectResult,
  withoutConnectResult,
} from '../accounts/connect-result';
import type { Notice } from '../accounts/connect-result';
import { AccountCard } from '../components/AccountCard';
import { ConnectYoutube } from '../components/ConnectYoutube';
import { describeLoadError } from '../dashboard/errors';
import { useAccounts } from '../dashboard/queries';

const TONE_BOX: Record<Notice['tone'], string> = {
  success: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  error: 'border-red-400/30 bg-red-500/10 text-red-200',
  info: 'border-panel-line bg-panel-card text-panel-text',
};

function NoticeBox({ notice }: { notice: Notice }) {
  return (
    <div
      role={notice.tone === 'error' ? 'alert' : 'status'}
      className={`mb-6 rounded-lg border px-4 py-3 text-sm ${TONE_BOX[notice.tone]}`}
    >
      {notice.text}
    </div>
  );
}

export function AccountsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const accounts = useAccounts();
  // El resultado de la conexión se lee una sola vez y la URL se limpia: al recargar, el aviso ya no está.
  const [connectOutcome] = useState(() => parseConnectResult(searchParams));
  const [disconnectNotice, setDisconnectNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (searchParams.has('youtube') || searchParams.has('reason')) {
      setSearchParams(withoutConnectResult(searchParams), { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const connectNotice = connectOutcome ? describeConnectResult(connectOutcome) : null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Cuentas</h1>

      {connectNotice && <NoticeBox notice={connectNotice} />}
      {disconnectNotice && <NoticeBox notice={disconnectNotice} />}

      <section aria-labelledby="conectadas-title" className="mb-10">
        <h2 id="conectadas-title" className="mb-3 text-lg font-semibold">
          Cuentas conectadas
        </h2>
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
        {accounts.data && accounts.data.length === 0 && (
          <p className="rounded-xl border border-panel-line bg-panel-card p-6 text-panel-muted">
            Todavía no has conectado ninguna cuenta. Empieza conectando tu canal de YouTube.
          </p>
        )}
        {accounts.data && accounts.data.length > 0 && (
          <ul className="space-y-4">
            {accounts.data.map((account) => (
              <AccountCard key={account.id} account={account} onDisconnected={setDisconnectNotice} />
            ))}
          </ul>
        )}
      </section>

      <ConnectYoutube />
    </div>
  );
}