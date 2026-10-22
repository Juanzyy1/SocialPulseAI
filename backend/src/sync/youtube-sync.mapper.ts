import { ReportTable } from '../analytics/report-parser';
import { ChannelStatistics } from '../integrations/youtube/youtube-analytics.client';

/** La respuesta de la plataforma no tiene la forma esperada: se rechaza en lugar de guardar. */
export class SyncDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncDataError';
  }
}

export interface MetricRow {
  date: string;
  metric: string;
  value: number;
}

export interface SnapshotRow {
  metric: string;
  value: number;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Una fecha AAAA-MM-DD que existe en el calendario (rechaza 2026-02-30). */
function isRealDate(value: string): boolean {
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/**
 * Convierte la tabla diaria de YouTube Analytics en filas (fecha, métrica, valor).
 * Solo guarda las métricas permitidas; ignora las demás columnas. Lanza SyncDataError si
 * falta `day`, si una fecha es inválida o cae fuera del rango pedido, o si un valor no es
 * un número finito. Si hay duplicados (fecha, métrica), gana el último.
 */
export function tableToMetricRows(
  table: ReportTable,
  allowedMetrics: readonly string[],
  range: { start: string; end: string },
): MetricRow[] {
  const dayIndex = table.columns.indexOf('day');
  if (dayIndex === -1) throw new SyncDataError('La respuesta no incluye la columna day');

  const metricColumns = table.columns
    .map((name, index) => ({ name, index }))
    .filter((column) => allowedMetrics.includes(column.name));

  const rows = new Map<string, MetricRow>();
  for (const row of table.rows) {
    const date = row[dayIndex];
    if (
      typeof date !== 'string' ||
      !DATE_PATTERN.test(date) ||
      !isRealDate(date) ||
      date < range.start ||
      date > range.end
    ) {
      throw new SyncDataError('La respuesta contiene una fecha inválida o fuera del rango pedido');
    }
    for (const { name, index } of metricColumns) {
      const value = row[index];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new SyncDataError(`La respuesta contiene un valor no numérico en ${name}`);
      }
      rows.set(`${date}|${name}`, { date, metric: name, value });
    }
  }
  return [...rows.values()];
}

/**
 * Totales puntuales del canal. YouTube los entrega como texto: solo se aceptan enteros.
 * Si los suscriptores están ocultos, no se guarda el total de suscriptores.
 */
export function statsToSnapshots(stats: ChannelStatistics): SnapshotRow[] {
  const candidates: Array<[string, string | null]> = [
    ['viewCount', stats.viewCount],
    ['subscriberCount', stats.hiddenSubscriberCount === true ? null : stats.subscriberCount],
    ['videoCount', stats.videoCount],
  ];
  const rows: SnapshotRow[] = [];
  for (const [metric, raw] of candidates) {
    if (raw === null || !/^\d+$/.test(raw)) continue;
    rows.push({ metric, value: Number(raw) });
  }
  return rows;
}