import { addDays } from '../common/dates/pacific-date';

export type PeriodKind = '7d' | '30d' | '90d' | 'custom' | 'previous';

export type PeriodRequest =
  | { kind: '7d' | '30d' | '90d' }
  | { kind: 'custom'; from: string; to: string };

export interface ResolvedPeriod {
  kind: PeriodKind;
  /** AAAA-MM-DD (fecha del Pacífico), ambos extremos incluidos. */
  start: string;
  end: string;
  days: number;
}

export interface DateRange {
  from: string;
  to: string;
}

export type ParsedPeriod =
  | { ok: true; request: PeriodRequest }
  | { ok: false; error: string };

const PRESET_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
export const MAX_CUSTOM_DAYS = 366;

/** Una fecha AAAA-MM-DD que existe en el calendario (rechaza 2026-02-30). */
function isIsoDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** Días entre dos fechas AAAA-MM-DD, ambos extremos incluidos. */
export function countDays(start: string, end: string): number {
  const diff = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(diff / DAY_MS) + 1;
}

const fail = (error: string): ParsedPeriod => ({ ok: false, error });

/**
 * Valida la combinación de parámetros de periodo: `period` o `from`+`to`, nunca ambos.
 * Sin parámetros, 30 días. `today` es la fecha actual del Pacífico.
 */
export function parsePeriodRequest(
  input: { period?: string; from?: string; to?: string },
  today: string,
): ParsedPeriod {
  const { period, from, to } = input;

  if (period !== undefined && (from !== undefined || to !== undefined)) {
    return fail('Usa period o from/to, no ambos');
  }
  if (period !== undefined) {
    if (period === '7d' || period === '30d' || period === '90d') {
      return { ok: true, request: { kind: period } };
    }
    return fail('period debe ser 7d, 30d o 90d');
  }
  if (from === undefined && to === undefined) {
    return { ok: true, request: { kind: '30d' } };
  }
  if (from === undefined || to === undefined) return fail('from y to deben indicarse juntos');
  if (!isIsoDay(from) || !isIsoDay(to)) {
    return fail('from y to deben ser fechas reales con formato AAAA-MM-DD');
  }
  if (from > to) return fail('from no puede ser posterior a to');
  if (to > today) return fail('to no puede ser posterior a hoy (fecha del Pacífico)');
  if (countDays(from, to) > MAX_CUSTOM_DAYS) {
    return fail(`El rango no puede superar ${MAX_CUSTOM_DAYS} días`);
  }
  return { ok: true, request: { kind: 'custom', from, to } };
}

/**
 * Rango concreto de una petición. Los periodos predefinidos terminan en el último día con
 * dato de la cuenta (null si no hay datos). Los personalizados se respetan tal cual.
 */
export function resolvePeriod(
  request: PeriodRequest,
  dataThrough: string | null,
): ResolvedPeriod | null {
  if (request.kind === 'custom') {
    return {
      kind: 'custom',
      start: request.from,
      end: request.to,
      days: countDays(request.from, request.to),
    };
  }
  if (dataThrough === null) return null;
  const days = PRESET_DAYS[request.kind];
  return { kind: request.kind, start: addDays(dataThrough, -(days - 1)), end: dataThrough, days };
}

export interface Coverage {
  daysWithData: number;
  missingDays: number;
  /** Tramos consecutivos de días sin dato dentro del rango. */
  missingRanges: DateRange[];
}

/** Cuántos días del rango tienen dato y qué tramos faltan. Nunca rellena con ceros. */
export function summarizeCoverage(
  start: string,
  end: string,
  datesWithData: ReadonlySet<string>,
): Coverage {
  const missingRanges: DateRange[] = [];
  let open: DateRange | null = null;
  let daysWithData = 0;
  let missingDays = 0;

  for (let date = start; date <= end; date = addDays(date, 1)) {
    if (datesWithData.has(date)) {
      daysWithData += 1;
      if (open) {
        missingRanges.push(open);
        open = null;
      }
    } else {
      missingDays += 1;
      if (open) open.to = date;
      else open = { from: date, to: date };
    }
  }
  if (open) missingRanges.push(open);
  return { daysWithData, missingDays, missingRanges };
}