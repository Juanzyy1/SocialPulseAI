import type { PeriodSelection } from '../dashboard/period-selection';
import { selectionQuery } from '../dashboard/period-selection';
import { apiFetch } from './client';
import type {
  AccountAnalytics,
  AuthUser,
  CatalogResponse,
  ComparisonResponse,
  DisconnectResult,
  LoginInput,
  OverviewResponse,
  Profile,
  RegisterInput,
  SocialAccount,
  SyncRun,
  TermsAcceptanceInput,
} from './types';

export const authApi = {
  /** No inicia sesión: después hay que llamar a login. */
  register: (input: RegisterInput) =>
    apiFetch<AuthUser>('/auth/register', { method: 'POST', body: input }),
  login: (input: LoginInput) => apiFetch<AuthUser>('/auth/login', { method: 'POST', body: input }),
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
};

export const usersApi = {
  me: () => apiFetch<Profile>('/users/me'),
  /** Registra la aceptación de los términos vigentes. Repetirlo no cambia la fecha original. */
  acceptTerms: (input: TermsAcceptanceInput) =>
    apiFetch<Profile>('/users/me/terms', { method: 'POST', body: input }),
};

export const accountsApi = {
  list: () => apiFetch<SocialAccount[]>('/social-accounts'),
  /** Responde 200 también cuando la sincronización falla: hay que revisar `status`. */
  sync: (accountId: string) =>
    apiFetch<SyncRun>(`/social-accounts/${encodeURIComponent(accountId)}/sync`, { method: 'POST' }),
  /** Borra la cuenta, sus credenciales y su historial, e intenta revocar el acceso en Google. */
  disconnect: (accountId: string) =>
    apiFetch<DisconnectResult>(`/social-accounts/${encodeURIComponent(accountId)}`, {
      method: 'DELETE',
    }),
};

export const analyticsApi = {
  catalog: () => apiFetch<CatalogResponse>('/analytics/metrics'),
  compare: (accountId: string, selection: PeriodSelection) =>
    apiFetch<ComparisonResponse>(
      `/analytics/compare?accountId=${encodeURIComponent(accountId)}&${selectionQuery(selection)}`,
    ),
  account: (accountId: string, selection: PeriodSelection) =>
    apiFetch<AccountAnalytics>(
      `/analytics/accounts/${encodeURIComponent(accountId)}?${selectionQuery(selection)}&daily=true`,
    ),
  overview: (selection: PeriodSelection) =>
    apiFetch<OverviewResponse>(`/analytics/overview?${selectionQuery(selection)}`),
};