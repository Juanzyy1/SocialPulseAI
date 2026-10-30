import type { DailyPoint, MetricUnit, Period } from '../api/types';
import { formatDate, formatDateRange, formatMetricValue, plural } from './format';

export interface ChartDay {
  date: string;
  /** null = no hay dato ese día. Un 0 es un dato real y NO es lo mismo. */
  value: number | null;
}

const DAY_MS = 86_400_000;
const MAX_DAYS = 400;

/** Todas las fechas AAAA-MM-DD de un rango, ambos extremos incluidos. Vacío si el rango no es válido. */
export function eachDay(start: string, end: string): string[] {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || from > to) return [];
  const count = Math.round((to - from) / DAY_MS) + 1;
  if (count > MAX_DAYS) return [];
  return Array.from({ length: count }, (_, index) =>
    new Date(from + index * DAY_MS).toISOString().slice(0, 10),
  );
}

/** Serie de todos los días del periodo; los días sin dato (o sin esa métrica) quedan en null, nunca en 0. */
export function buildDaySeries(
  period: Pick<Period, 'start' | 'end'>,
  daily: readonly DailyPoint[],
  metric: string,
): ChartDay[] {
  const byDate = new Map(daily.map((point) => [point.date, point.values[metric]] as const));
  return eachDay(period.start, period.end).map((date) => {
    const value = byDate.get(date);
    return { date, value: typeof value === 'number' && Number.isFinite(value) ? value : null };
  });
}

export interface YScale {
  max: number;
  ticks: number[];
}

// Pasos "redondos" candidatos para el eje vertical, de menor a mayor.
const STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Escala del eje vertical: de 0 a un máximo redondo, con marcas enteras. */
export function yScale(dataMax: number): YScale {
  const max = Number.isFinite(dataMax) && dataMax > 0 ? Math.ceil(dataMax) : 0;
  if (max <= 4) {
    const top = Math.max(1, max);
    return { max: top, ticks: Array.from({ length: top + 1 }, (_, index) => index) };
  }

  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  let step = (STEPS.find((candidate) => candidate >= normalized) ?? 10) * magnitude;
  if (!Number.isInteger(step)) step = Math.ceil(step); // las marcas del eje son enteros
  const top = step * 4;
  return { max: top, ticks: [0, step, step * 2, step * 3, top] };
}

export interface ChartGeometry {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export type BarKind = 'data' | 'zero' | 'gap';

export interface Bar {
  date: string;
  value: number | null;
  kind: BarKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

const ZERO_HEIGHT = 2; // línea fina en la base: un cero es un dato real
const GAP_HEIGHT = 10; // contorno punteado: no hay dato
const MIN_BAR_HEIGHT = 2;

/** Posición y tamaño de la barra de cada día dentro del área de dibujo. */
export function layoutBars(
  days: readonly ChartDay[],
  geometry: ChartGeometry,
  yMax: number,
): Bar[] {
  const plotWidth = geometry.width - geometry.left - geometry.right;
  const plotHeight = geometry.height - geometry.top - geometry.bottom;
  if (days.length === 0 || plotWidth <= 0 || plotHeight <= 0 || yMax <= 0) return [];

  const slot = plotWidth / days.length;
  const barWidth = Math.max(1, slot * 0.7);
  const baseline = geometry.top + plotHeight;

  return days.map((day, index) => {
    const x = geometry.left + index * slot + (slot - barWidth) / 2;
    const common = { date: day.date, value: day.value, x, width: barWidth };

    if (day.value === null) {
      return { ...common, kind: 'gap', height: GAP_HEIGHT, y: baseline - GAP_HEIGHT };
    }
    if (day.value <= 0) {
      return { ...common, kind: 'zero', height: ZERO_HEIGHT, y: baseline - ZERO_HEIGHT };
    }
    const height = Math.min(plotHeight, Math.max(MIN_BAR_HEIGHT, (day.value / yMax) * plotHeight));
    return { ...common, kind: 'data', height, y: baseline - height };
  });
}

/** Índices de los días que llevan etiqueta en el eje horizontal. */
export function labelIndexes(count: number): number[] {
  if (count <= 0) return [];
  if (count <= 7) return Array.from({ length: count }, (_, index) => index);
  const last = count - 1;
  return [0, Math.round(last / 3), Math.round((2 * last) / 3), last];
}

/** Texto de ayuda de un día, para el tooltip y la tabla. */
export function describeDay(day: ChartDay, label: string, unit: MetricUnit): string {
  const value =
    day.value === null ? 'sin dato' : `${formatMetricValue(day.value, unit)} ${label.toLowerCase()}`;
  return `${formatDate(day.date)}: ${value}`;
}

/** Resumen de la serie completa para quien no puede ver el gráfico. */
export function describeSeries(days: readonly ChartDay[], label: string, unit: MetricUnit): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return `${label} por día: sin datos.`;

  const values = days.flatMap((day) => (day.value === null ? [] : [day.value]));
  const total = values.reduce((sum, value) => sum + value, 0);
  const zeros = values.filter((value) => value === 0).length;
  const missing = days.length - values.length;

  return `${label} por día, ${formatDateRange(first.date, last.date)}. Total: ${formatMetricValue(total, unit)}. ${plural(zeros, 'día', 'días')} en cero, ${plural(missing, 'día', 'días')} sin dato.`;
}