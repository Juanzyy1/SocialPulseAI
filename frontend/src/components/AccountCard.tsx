import { useEffect, useRef, useState } from 'react';
import { YOUTUBE_CONNECT_URL } from '../accounts/connect-result';
import type { Notice } from '../accounts/connect-result';
import {
  describeDisconnectError,
  describeDisconnectResult,
  describeSyncError,
  describeSyncResult,
} from '../accounts/messages';
import { useDisconnectAccount, useSyncAccount } from '../accounts/mutations';
import type { SocialAccount } from '../api/types';
import { accountLabel, platformLabel } from '../dashboard/account-params';
import { describeLastSync } from '../dashboard/account-status';
import { formatTimestampDate } from '../dashboard/format';
import { StatusBadge } from './StatusBadge';

const BUTTON =
  'rounded-lg border border-panel-line px-3 py-1.5 text-sm transition-colors hover:bg-panel-line disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

const TONE_TEXT: Record<Notice['tone'], string> = {
  success: 'text-emerald-300',
  error: 'text-red-300',
  info: 'text-panel-muted',
};

interface AccountCardProps {
  account: SocialAccount;
  /** El aviso de la desconexión lo muestra la página: esta tarjeta desaparece al desconectar. */
  onDisconnected: (notice: Notice) => void;
}

export function AccountCard({ account, onDisconnected }: AccountCardProps) {
  const sync = useSyncAccount(account.id);
  const disconnect = useDisconnectAccount(account.id);
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const name = accountLabel(account);
  const active = account.status === 'ACTIVE';
  const syncNotice = sync.data ? describeSyncResult(sync.data) : null;

  // Al pedir la confirmación, el foco va a "Cancelar": la opción segura por defecto.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  return (
    <li className="rounded-xl border border-panel-line bg-panel-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{name}</h3>
          <p className="mt-1 text-xs text-panel-muted">
            {platformLabel(account.platform)} · {describeLastSync(account.lastSyncedAt)} · Conectada el{' '}
            {formatTimestampDate(account.connectedAt)}
          </p>
        </div>
        <StatusBadge status={account.status} />
      </div>

      {!active && (
        <p role="status" className="mt-3 text-sm text-amber-300">
          Esta cuenta no tiene acceso vigente: no se pueden traer datos nuevos hasta reconectarla. Sus datos
          guardados se conservan.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {active ? (
          <button
            type="button"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            aria-busy={sync.isPending || undefined}
            className={BUTTON}
          >
            {sync.isPending ? 'Sincronizando…' : 'Sincronizar'}
          </button>
        ) : (
          <a href={YOUTUBE_CONNECT_URL} className={`${BUTTON} inline-block`}>
            Reconectar
          </a>
        )}
        {!confirming && (
          <button type="button" onClick={() => setConfirming(true)} className={BUTTON}>
            Desconectar
          </button>
        )}
      </div>

      {syncNotice && (
        <p role="status" className={`mt-3 text-sm ${TONE_TEXT[syncNotice.tone]}`}>
          {syncNotice.text}
        </p>
      )}
      {sync.isError && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {describeSyncError(sync.error)}
        </p>
      )}

      {confirming && (
        <div
          role="group"
          aria-label={`Confirmar la desconexión de ${name}`}
          className="mt-4 rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 text-sm"
        >
          <p className="text-amber-100">
            ¿Desconectar «{name}»? Se borrarán sus credenciales y todas las estadísticas guardadas de esta
            cuenta, y se intentará revocar el acceso en Google. Podrás volver a conectarla más adelante,
            pero solo se recuperarán los últimos 90 días.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disconnect.isPending}
              aria-busy={disconnect.isPending || undefined}
              onClick={() =>
                disconnect.mutate(undefined, {
                  onSuccess: (result) => onDisconnected(describeDisconnectResult(result)),
                })
              }
              className={`${BUTTON} border-red-400/50 text-red-200`}
            >
              {disconnect.isPending ? 'Desconectando…' : 'Sí, desconectar'}
            </button>
            <button
              ref={cancelRef}
              type="button"
              disabled={disconnect.isPending}
              onClick={() => setConfirming(false)}
              className={BUTTON}
            >
              Cancelar
            </button>
          </div>
          {disconnect.isError && (
            <p role="alert" className="mt-3 text-red-300">
              {describeDisconnectError(disconnect.error)}
            </p>
          )}
        </div>
      )}
    </li>
  );
}