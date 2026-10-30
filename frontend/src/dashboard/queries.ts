import { useQuery } from '@tanstack/react-query';
import { accountsApi, analyticsApi } from '../api/endpoints';
import type { PeriodPreset } from './period-params';

// La primera parte de cada clave ('accounts', 'analytics') no es 'session': al cerrar sesión o
// caducar, estos datos se borran y no sobreviven al usuario.

export function useAccounts() {
  return useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.list() });
}

/** El catálogo es estático: se pide una sola vez. */
export function useCatalog() {
  return useQuery({
    queryKey: ['analytics', 'catalog'],
    queryFn: () => analyticsApi.catalog(),
    staleTime: Infinity,
  });
}

export function useComparison(accountId: string, period: PeriodPreset) {
  return useQuery({
    queryKey: ['analytics', 'compare', accountId, period],
    queryFn: () => analyticsApi.compare(accountId, period),
    staleTime: 60_000,
  });
}

export function useAccountAnalytics(accountId: string, period: PeriodPreset) {
  return useQuery({
    queryKey: ['analytics', 'account', accountId, period],
    queryFn: () => analyticsApi.account(accountId, period),
    staleTime: 60_000,
  });
}