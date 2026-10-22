import { addDays } from '../common/dates/pacific-date';

const WINDOW_DAYS = 7; // cuántos días se releen siempre (datos tardíos o corregidos)
const INITIAL_DAYS = 90; // carga inicial: el filtro máximo de MVP_SPEC.md

export interface SyncRange {
  /** AAAA-MM-DD (fecha del Pacífico). */
  start: string;
  end: string;
  kind: 'initial' | 'incremental';
}

/**
 * Rango a pedir en la próxima sincronización.
 * - Sin datos previos: los últimos 90 días.
 * - Con datos: desde 7 días antes del último dato (relee correcciones y cubre huecos),
 *   sin pasar de 90 días atrás. El fin es siempre hoy en el Pacífico.
 */
export function planSyncRange(today: string, lastMetricDate: string | null): SyncRange {
  const earliest = addDays(today, -(INITIAL_DAYS - 1));
  if (lastMetricDate === null) return { start: earliest, end: today, kind: 'initial' };

  const windowStart = addDays(today, -(WINDOW_DAYS - 1));
  const fromLast = addDays(lastMetricDate, -(WINDOW_DAYS - 1));
  // Las fechas AAAA-MM-DD se ordenan bien como texto: gana la más antigua.
  const start = fromLast < windowStart ? fromLast : windowStart;
  return { start: start < earliest ? earliest : start, end: today, kind: 'incremental' };
}