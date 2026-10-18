/**
 * Campos públicos de una cuenta social. Lista explícita a propósito: la credencial
 * (tokens) jamás debe salir de la base por accidente. Se comparte para que ninguna
 * consulta pueda olvidarse de esta protección.
 */
export const SOCIAL_ACCOUNT_SELECT = {
  id: true,
  platform: true,
  platformAccountId: true,
  displayName: true,
  handle: true,
  avatarUrl: true,
  status: true,
  connectedAt: true,
  lastSyncedAt: true,
} as const;