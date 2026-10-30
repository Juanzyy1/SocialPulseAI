import type { AccountStatus, CatalogResponse, OverviewResponse } from '../api/types';
import { platformLabel, withAccount } from './account-params';
import { describeLastSync } from './account-status';
import { NO_DATA_TEXT } from './cards';
import { formatDate, formatMetricValue, plural } from './format';
import { withSelection } from './period-selection';
import type { PeriodSelection } from './period-selection';

const PARTIAL_NOTE =
  'Totales parciales: alguna cuenta no tiene datos en todos los días de este periodo. Revisa la cobertura de cada cuenta.';
const NO_DATA_NOTE = 'Ninguna cuenta de esta plataforma tiene datos en este periodo.';

function labelOf(catalog: CatalogResponse, platform: string, code: string): string {
  const definitions = catalog.platforms.find((item) => item.platform === platform)?.metrics ?? [];
  return definitions.find((metric) => metric.code === code)?.label ?? code;
}

export interface PlatformCardModel {
  code: string;
  label: string;
  valueText: string;
  hasValue: boolean;
  accountsText: string;
  note: string | null;
}

export interface PlatformSectionModel {
  platform: string;
  title: string;
  accountsText: string;
  /** Aviso cuando los totales son parciales o no hay datos; null si todo está completo. */
  notice: string | null;
  cards: PlatformCardModel[];
}

/** Una sección por plataforma, con las métricas combinadas de sus cuentas. Nada se suma entre plataformas. */
export function buildPlatformSections(
  response: OverviewResponse,
  catalog: CatalogResponse,
): PlatformSectionModel[] {
  return response.platforms.map((platform) => {
    const withoutData = platform.accountCount - platform.accountsWithData;
    return {
      platform: platform.platform,
      title: platformLabel(platform.platform),
      accountsText:
        plural(platform.accountCount, 'cuenta', 'cuentas') +
        (withoutData > 0 ? ` · ${platform.accountsWithData} con datos` : ''),
      notice:
        platform.accountsWithData === 0 ? NO_DATA_NOTE : platform.complete ? null : PARTIAL_NOTE,
      cards: platform.metrics.map((metric) => {
        const hasValue = metric.value !== null && metric.accountsIncluded > 0;
        return {
          code: metric.metric,
          label: labelOf(catalog, platform.platform, metric.metric),
          valueText: hasValue ? formatMetricValue(metric.value, metric.unit) : NO_DATA_TEXT,
          hasValue,
          accountsText:
            metric.accountsIncluded === 0
              ? 'Ninguna cuenta aporta dato'
              : `Cuentas incluidas: ${metric.accountsIncluded} de ${platform.accountCount}`,
          note: metric.note,
        };
      }),
    };
  });
}

export interface AccountRowModel {
  id: string;
  name: string;
  platformText: string;
  status: AccountStatus;
  lastSyncText: string;
  dataThroughText: string;
  coverageText: string;
  /** true si a la cuenta le faltan días dentro del periodo. */
  coverageWarning: boolean;
  viewsLabel: string;
  viewsText: string;
  /** Totales de ESTA cuenta; nunca se suman entre cuentas. */
  totals: Array<{ label: string; valueText: string }>;
}

export function buildAccountRows(
  response: OverviewResponse,
  catalog: CatalogResponse,
): AccountRowModel[] {
  return response.accounts.map((account) => {
    const coverage = account.coverage;
    const views = account.metrics.find((metric) => metric.metric === 'views');
    const hasViews = views !== undefined && views.value !== null && views.daysWithData > 0;

    return {
      id: account.id,
      name: account.displayName?.trim() || 'Cuenta sin nombre',
      platformText: platformLabel(account.platform),
      status: account.status,
      lastSyncText: describeLastSync(account.lastSyncedAt),
      dataThroughText: account.dataThrough ? `Datos hasta el ${formatDate(account.dataThrough)}` : 'Sin datos',
      coverageText:
        coverage === null || coverage.daysWithData === 0
          ? 'Sin datos en este periodo'
          : `${coverage.daysWithData} de ${coverage.daysWithData + coverage.missingDays} días con dato`,
      coverageWarning: coverage !== null && coverage.missingDays > 0,
      viewsLabel: labelOf(catalog, account.platform, 'views'),
      viewsText: hasViews ? formatMetricValue(views.value, views.unit) : NO_DATA_TEXT,
      totals: account.totals.map((total) => ({
        label: labelOf(catalog, account.platform, total.metric),
        valueText: formatMetricValue(total.value, total.unit),
      })),
    };
  });
}

/** Enlace al panel de una cuenta conservando el periodo elegido. */
export function accountDashboardLink(accountId: string, selection: PeriodSelection): string {
  return `/?${withAccount(withSelection(new URLSearchParams(), selection), accountId).toString()}`;
}