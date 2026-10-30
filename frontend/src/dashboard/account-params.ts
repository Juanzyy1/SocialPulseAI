import type { AccountStatus, SocialAccount } from '../api/types';

/** Cuenta a mostrar: la pedida en la URL si existe; si no, la primera. Sin cuentas, null. */
export function pickAccount(
  accounts: readonly SocialAccount[],
  requestedId: string | null,
): SocialAccount | null {
  if (accounts.length === 0) return null;
  return accounts.find((account) => account.id === requestedId) ?? accounts[0] ?? null;
}

/** Copia de los parámetros con la cuenta indicada, conservando el resto. No modifica el original. */
export function withAccount(params: URLSearchParams, accountId: string): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set('account', accountId);
  return next;
}

/** Nombre para mostrar: el nombre del canal, o su alias, o su identificador. */
export function accountLabel(account: SocialAccount): string {
  return account.displayName?.trim() || account.handle?.trim() || account.platformAccountId;
}

const PLATFORM_LABELS: Record<string, string> = {
  YOUTUBE: 'YouTube',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

/** Aviso para cuentas sin acceso vigente; null si la cuenta está bien. */
export function accountStatusNotice(status: AccountStatus): string | null {
  switch (status) {
    case 'ACTIVE':
      return null;
    case 'REVOKED':
      return 'El acceso a esta cuenta fue revocado o caducó. Se muestran los datos guardados hasta ahora; vuelve a conectarla para recibir datos nuevos.';
    case 'ERROR':
      return 'Esta cuenta tiene un problema de conexión. Se muestran los datos guardados hasta ahora; revisa su estado en Cuentas.';
  }
}