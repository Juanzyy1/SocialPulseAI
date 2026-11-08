import { useEffect, useRef, useState } from 'react';
import {
  INSTAGRAM_CONNECT_URL,
  TIKTOK_CONNECT_URL,
  YOUTUBE_CONNECT_URL,
} from '../account/connect-result';
import type { Notice } from '../account/connect-result';
import {
  describeDisconnectError,
  describeDisconnectResult,
  describeSyncError,
  describeSyncResult,
} from '../account/messages';
import { useDisconnectAccount, useSyncAccount } from '../account/mutations';
import type { SocialAccount } from '../api/types';
import { accountLabel, platformLabel } from '../dashboard/account-params';
import { describeLastSync } from '../dashboard/account-status';
import { StatusBadge } from './StatusBadge';
import { PlatformIcon } from './PlatformIcon';

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
  const connectUrl =
    account.platform === 'INSTAGRAM'
      ? INSTAGRAM_CONNECT_URL
      : account.platform === 'YOUTUBE'
        ? YOUTUBE_CONNECT_URL
        : account.platform === 'TIKTOK'
          ? TIKTOK_CONNECT_URL
        : null;
  const syncNotice = sync.data ? describeSyncResult(sync.data) : null;

  // Al pedir la confirmación, el foco va a "Cancelar": la opción segura por defecto.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  return (
    <li className="rounded-2xl border border-panel-line bg-panel-card p-4 transition-colors hover:border-white/15 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <PlatformIcon platform={account.platform} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold">{name}</h3>
              <StatusBadge status={account.status} />
            </div>
            <p className="mt-1 truncate text-sm text-panel-muted">
              {account.handle && account.handle !== name ? account.handle : platformLabel(account.platform)}
              <span className="mx-2 text-panel-line">·</span>
              {describeLastSync(account.lastSyncedAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {active &&
          (account.platform === 'YOUTUBE' ||
            account.platform === 'INSTAGRAM' ||
            account.platform === 'TIKTOK') ? (
            <button
              type="button"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              aria-busy={sync.isPending || undefined}
              className={BUTTON}
            >
              {sync.isPending ? 'Sincronizando…' : 'Sincronizar'}
            </button>
          ) : !active && connectUrl ? (
            <a href={connectUrl} className={`${BUTTON} inline-block`}>
              Reconectar
            </a>
          ) : null}
          {active && account.platform !== 'YOUTUBE' && connectUrl && (
            <a href={connectUrl} className={`${BUTTON} inline-block`}>
              Volver a conectar
            </a>
          )}
          {!confirming && (
            <button type="button" onClick={() => setConfirming(true)} className={BUTTON}>
              Desconectar
            </button>
          )}
        </div>
      </div>

      {!active && (
        <p role="status" className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-sm text-amber-200">
          Esta cuenta no tiene acceso vigente. Reconecta para traer datos nuevos; los datos guardados se conservan.
        </p>
      )}

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
            cuenta. Podrás volver a conectarla más adelante.
            {account.platform === 'INSTAGRAM'
              ? ' Para revocar el acceso en Meta, quita SocialPulse AI de las integraciones de tu negocio.'
              : account.platform === 'TIKTOK'
                ? ' Intentaremos revocar el acceso en TikTok.'
                : ' Intentaremos revocar el acceso en Google; al reconectar solo se recuperarán los últimos 90 días.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disconnect.isPending}
              aria-busy={disconnect.isPending || undefined}
              onClick={() =>
                disconnect.mutate(undefined, {
                  onSuccess: (result) =>
                    onDisconnected(describeDisconnectResult(result, account.platform)),
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