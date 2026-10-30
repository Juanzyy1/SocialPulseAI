import type { Coverage } from '../api/types';
import { formatDate, formatDateRange, formatTimestampDate, plural, wholeDaysSince } from './format';

export interface FreshnessInput {
  dataThrough: string | null;
  daysBehind: number | null;
  coverage: Coverage | null;
  /** Instante ISO de la última sincronización de la cuenta, o null si nunca se sincronizó. */
  lastSyncedAt: string | null;
  now: Date;
}

export interface FreshnessInfo {
  headline: string;
  /** Retraso normal de la plataforma al publicar los datos recientes. No es una advertencia. */
  lag: string | null;
  /** La cuenta lleva tiempo sin sincronizarse. Es una advertencia con una acción. */
  sync: string | null;
  /** Días del periodo que no tienen dato. Es una advertencia. */
  gaps: string | null;
}

/** A partir de cuántos días completos sin sincronizar se avisa. */
const STALE_SYNC_DAYS = 1;
const MAX_LISTED_RANGES = 3;

/**
 * Hasta qué fecha hay datos y por qué falta lo que falta, para que nadie lea un hueco como un cero.
 * El retraso solo se atribuye a la plataforma si la cuenta se sincronizó hace poco; si no, el motivo
 * es que hay que sincronizar.
 */
export function describeFreshness(input: FreshnessInput): FreshnessInfo {
  if (input.dataThrough === null) {
    return { headline: 'Todavía no hay datos de esta cuenta', lag: null, sync: null, gaps: null };
  }

  const syncAge = input.lastSyncedAt ? wholeDaysSince(input.lastSyncedAt, input.now) : null;
  const staleSync = input.lastSyncedAt !== null && syncAge !== null && syncAge >= STALE_SYNC_DAYS;

  let sync: string | null = null;
  let lag: string | null = null;
  if (staleSync && input.lastSyncedAt !== null && syncAge !== null) {
    sync = `Última sincronización: ${formatTimestampDate(input.lastSyncedAt)} (hace ${plural(syncAge, 'día', 'días')}). Sincroniza la cuenta para traer los datos más recientes.`;
  } else {
    const behind = input.daysBehind ?? 0;
    if (behind > 0) {
      lag = `Los datos más recientes tardan en estar disponibles: ${behind === 1 ? 'falta 1 día' : `faltan ${behind} días`} hasta hoy.`;
    }
  }

  let gaps: string | null = null;
  const coverage = input.coverage;
  if (coverage && coverage.missingDays > 0) {
    const listed = coverage.missingRanges
      .slice(0, MAX_LISTED_RANGES)
      .map((range) => formatDateRange(range.from, range.to))
      .join('; ');
    const more = coverage.missingRanges.length > MAX_LISTED_RANGES ? ' y otros tramos' : '';
    gaps = `Faltan ${plural(coverage.missingDays, 'día', 'días')} de datos dentro de este periodo (${listed}${more}).`;
  }

  return { headline: `Datos hasta el ${formatDate(input.dataThrough)}`, lag, sync, gaps };
}