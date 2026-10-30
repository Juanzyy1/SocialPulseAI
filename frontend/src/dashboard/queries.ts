import { useQuery } from '@tanstack/react-query';
import { accountsApi, analyticsApi } from '../api/endpoints';
import { selectionKey } from './period-selection';
import type { PeriodSelection } from './period-selection';

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

export function useComparison(accountId: string, selection: PeriodSelection) {
  return useQuery({
    queryKey: ['analytics', 'compare', accountId, selectionKey(selection)],
    queryFn: () => analyticsApi.compare(accountId, selection),
    staleTime: 60_000,
  });
}

export function useAccountAnalytics(accountId: string, selection: PeriodSelection) {
  return useQuery({
    queryKey: ['analytics', 'account', accountId, selectionKey(selection)],
    queryFn: () => analyticsApi.account(accountId, selection),
    staleTime: 60_000,
  });
}

export function useOverview(selection: PeriodSelection) {
  return useQuery({
    queryKey: ['analytics', 'overview', selectionKey(selection)],
    queryFn: () => analyticsApi.overview(selection),
    staleTime: 60_000,
  });
}