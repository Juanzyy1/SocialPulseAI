import { countDays, isRealIsoDay } from './dates';
import { formatDateRange } from './format';
import { DEFAULT_PERIOD, PERIOD_OPTIONS, parsePeriod } from './period-params';
import type { PeriodPreset } from './period-params';

export const MAX_CUSTOM_DAYS = 366;

/** Periodo elegido: uno de los predefinidos, o un rango de fechas del Pacífico. */
export type PeriodSelection =
  | { kind: 'preset'; period: PeriodPreset }
  | { kind: 'custom'; from: string; to: string };

export function presetSelection(period: PeriodPreset): PeriodSelection {
  return { kind: 'preset', period };
}

/** Mensaje de error de un rango personalizado, o null si es válido. Repite las reglas del backend. */
export function customRangeError(from: string, to: string, today: string): string | null {
  if (from === '' || to === '') return 'Elige la fecha inicial y la final';
  if (!isRealIsoDay(from) || !isRealIsoDay(to)) return 'Las fechas no son válidas';
  if (from > to) return 'La fecha inicial no puede ser posterior a la final';
  if (to > today) return 'La fecha final no puede ser posterior a hoy';
  if (countDays(from, to) > MAX_CUSTOM_DAYS) return `El rango no puede superar ${MAX_CUSTOM_DAYS} días`;
  return null;
}

/**
 * Periodo según la URL. Cualquier valor inválido (fechas mal formadas, en el futuro, demasiado largo,
 * un periodo desconocido) vuelve al predeterminado: la página nunca se rompe por una URL escrita a mano.
 */
export function parseSelection(params: URLSearchParams, today: string): PeriodSelection {
  const from = params.get('from');
  const to = params.get('to');
  if (from !== null && to !== null && customRangeError(from, to, today) === null) {
    return { kind: 'custom', from, to };
  }
  if (from !== null || to !== null) return presetSelection(DEFAULT_PERIOD);
  return presetSelection(parsePeriod(params.get('period')));
}

/** Copia de los parámetros con el periodo indicado y sin restos del otro modo. No modifica el original. */
export function withSelection(params: URLSearchParams, selection: PeriodSelection): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete('period');
  next.delete('from');
  next.delete('to');
  if (selection.kind === 'preset') {
    next.set('period', selection.period);
  } else {
    next.set('from', selection.from);
    next.set('to', selection.to);
  }
  return next;
}

/** Parámetros de la petición al backend: `period=7d` o `from=...&to=...`, nunca ambos. */
export function selectionQuery(selection: PeriodSelection): string {
  return withSelection(new URLSearchParams(), selection).toString();
}

/** Identificador estable para las claves de la caché de consultas. */
export function selectionKey(selection: PeriodSelection): string {
  return selection.kind === 'preset' ? selection.period : `${selection.from}..${selection.to}`;
}

export function describeSelection(selection: PeriodSelection): string {
  if (selection.kind === 'custom') return formatDateRange(selection.from, selection.to);
  const label = PERIOD_OPTIONS.find((option) => option.value === selection.period)?.label ?? '';
  return `Últimos ${label}`;
}