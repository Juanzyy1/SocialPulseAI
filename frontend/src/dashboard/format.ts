import type { MetricUnit } from '../api/types';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Texto para un valor ausente. */
export const NO_VALUE = '—';

/** Separador de miles con punto, sin depender del idioma ni de la versión de ICU del navegador. */
function group(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Entero con separador de miles ("1.234"). */
export function formatCount(value: number): string {
  const rounded = Math.round(Math.abs(value));
  return `${value < 0 && rounded !== 0 ? '-' : ''}${group(String(rounded))}`;
}

/** Duración en segundos como m:ss, o h:mm:ss a partir de una hora. */
export function formatDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** Minutos como "45 min", "2 h" o "2 h 5 min". */
export function formatMinutes(totalMinutes: number): string {
  const total = Math.max(0, Math.round(totalMinutes));
  if (total < 60) return `${group(String(total))} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes === 0 ? `${group(String(hours))} h` : `${group(String(hours))} h ${minutes} min`;
}

export function formatMetricValue(value: number | null, unit: MetricUnit): string {
  if (value === null) return NO_VALUE;
  switch (unit) {
    case 'count':
      return formatCount(value);
    case 'minutes':
      return formatMinutes(value);
    case 'seconds':
      return formatDuration(value);
  }
}

/** Variación con signo: "+3", "-2". Cero no lleva signo. */
export function formatSignedValue(change: number, unit: MetricUnit): string {
  if (change === 0) return formatMetricValue(0, unit);
  return `${change > 0 ? '+' : '-'}${formatMetricValue(Math.abs(change), unit)}`;
}

/** Porcentaje con una decimal y coma: "+28,4 %". */
export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(1).replace('.', ',')} %`;
}

/** "2026-10-19" a "19 oct 2026". Si no es una fecha válida, devuelve el texto tal cual. */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1];
  if (month === undefined) return iso;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

export function formatDateRange(from: string, to: string): string {
  return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
}

/** "3 días" o "1 día": el número y la palabra en singular o plural. */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Fecha local de un instante ISO (por ejemplo, "2026-10-22T14:24:44.456Z") como "22 oct 2026". */
export function formatTimestampDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getDate()} ${MONTHS[date.getMonth()] ?? ''} ${date.getFullYear()}`;
}

/** Días completos transcurridos desde un instante hasta `now`; null si el texto no es una fecha. */
export function wholeDaysSince(iso: string, now: Date): number | null {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((now.getTime() - time) / 86_400_000));
}