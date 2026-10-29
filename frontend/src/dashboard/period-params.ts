export type PeriodPreset = '7d' | '30d' | '90d';

export const DEFAULT_PERIOD: PeriodPreset = '30d';

export const PERIOD_OPTIONS: ReadonlyArray<{ value: PeriodPreset; label: string }> = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
];

/** Periodo de la URL; cualquier valor ausente o desconocido usa el predeterminado. */
export function parsePeriod(value: string | null): PeriodPreset {
  return PERIOD_OPTIONS.find((option) => option.value === value)?.value ?? DEFAULT_PERIOD;
}

/** Copia de los parámetros con el periodo indicado, conservando el resto. No modifica el original. */
export function withPeriod(params: URLSearchParams, period: PeriodPreset): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set('period', period);
  return next;
}