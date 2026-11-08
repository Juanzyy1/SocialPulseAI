import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  describeConnectResult,
  parseConnectResult,
  withoutConnectResult,
} from '../account/connect-result';
import type { Notice } from '../account/connect-result';
import { AccountCard } from '../components/AccountCard';
import { ConnectInstagram } from '../components/ConnectInstagram';
import { ConnectTikTok } from '../components/ConnectTikTok';
import { ConnectYoutube } from '../components/ConnectYoutube';
import { PlatformIcon } from '../components/PlatformIcon';
import type { SocialAccount } from '../api/types';
import { describeLoadError } from '../dashboard/errors';
import { useAccounts } from '../dashboard/queries';

const TONE_BOX: Record<Notice['tone'], string> = {
  success: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  error: 'border-red-400/30 bg-red-500/10 text-red-200',
  info: 'border-panel-line bg-panel-card text-panel-text',
};

const PLATFORM_GROUPS: readonly { platform: SocialAccount['platform']; label: string }[] = [
  { platform: 'YOUTUBE', label: 'YouTube' },
  { platform: 'INSTAGRAM', label: 'Instagram' },
  { platform: 'TIKTOK', label: 'TikTok' },
];

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
    if (
      searchParams.has('youtube') ||
      searchParams.has('instagram') ||
      searchParams.has('tiktok') ||
      searchParams.has('reason')
    ) {
      setSearchParams(withoutConnectResult(searchParams), { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const connectNotice = connectOutcome ? describeConnectResult(connectOutcome) : null;

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-chart-1">Conexiones</p>
        <h1 className="mt-1 text-2xl font-semibold">Cuentas</h1>
        <p className="mt-1 text-sm text-panel-muted">Administra tus perfiles y sincroniza sus métricas.</p>
      </div>

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
            Todavía no has conectado ninguna cuenta. Empieza conectando YouTube, Instagram o TikTok.
          </p>
        )}
        {accounts.data && accounts.data.length > 0 && (
          <div className="space-y-6">
            {PLATFORM_GROUPS.map(({ platform, label }) => {
              const platformAccounts = accounts.data.filter((account) => account.platform === platform);
              if (platformAccounts.length === 0) return null;
              return (
                <section key={platform} aria-labelledby={`accounts-${platform}`}>
                  <h3 id={`accounts-${platform}`} className="mb-3 flex items-center gap-3 text-sm font-medium text-panel-muted">
                    <PlatformIcon platform={platform} size="sm" />
                    <span>{label}</span>
                    <span className="text-xs text-panel-muted/70">{platformAccounts.length}</span>
                  </h3>
                  <ul className="space-y-3">
                    {platformAccounts.map((account) => (
                      <AccountCard key={account.id} account={account} onDisconnected={setDisconnectNotice} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="conectar-plataformas-title" className="mt-12">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-chart-1">Añadir perfil</p>
          <h2 id="conectar-plataformas-title" className="mt-1 text-lg font-semibold">Conectar una plataforma</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <ConnectYoutube />
          <ConnectInstagram />
          <ConnectTikTok />
        </div>
      </section>
    </div>
  );
}