import { pacificDate } from '../../common/dates/pacific-date';
import { MetricRow, SyncDataError } from '../../sync/sync-adapter';
import { SyncRange } from '../../sync/sync-range';

interface InsightValue {
  end_time: string;
  value: number | null;
}

interface ReachInsight {
  name: string;
  period: string;
  values: InsightValue[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseInsight(value: unknown): ReachInsight {
  if (
    !isRecord(value) ||
    value.name !== 'reach' ||
    value.period !== 'day' ||
    !Array.isArray(value.values)
  ) {
    throw new SyncDataError('Meta devolvió una serie diaria de alcance inválida');
  }

  const values: InsightValue[] = [];
  for (const point of value.values) {
    if (!isRecord(point)) {
      throw new SyncDataError('Meta devolvió un punto diario de alcance inválido');
    }
    const endTime = point.end_time;
    const metricValue = point.value;
    if (
      typeof endTime !== 'string' ||
      !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(endTime) ||
      !Number.isFinite(Date.parse(endTime)) ||
      (metricValue !== null &&
        (typeof metricValue !== 'number' || !Number.isFinite(metricValue) || metricValue < 0))
    ) {
      throw new SyncDataError('Meta devolvió un punto diario de alcance inválido');
    }
    values.push({
      end_time: endTime,
      value: metricValue === null ? null : metricValue,
    });
  }
  return { name: 'reach', period: 'day', values };
}

/** Interpreta solo la serie temporal `reach`; una ausencia de Meta no se convierte en cero. */
export function parseDailyReach(response: unknown, range: SyncRange): MetricRow[] {
  if (!isRecord(response) || !Array.isArray(response.data)) {
    throw new SyncDataError('Meta devolvió una respuesta de Insights inválida');
  }

  const rows = new Map<string, number>();
  for (const rawInsight of response.data) {
    if (!isRecord(rawInsight) || typeof rawInsight.name !== 'string') {
      throw new SyncDataError('Meta devolvió una métrica de Insights inválida');
    }
    if (rawInsight.name !== 'reach') {
      throw new SyncDataError('Meta devolvió una métrica de Insights no solicitada');
    }

    const insight = parseInsight(rawInsight);
    for (const point of insight.values) {
      if (point.value === null) continue;
      const date = pacificDate(new Date(point.end_time));
      if (date < range.start || date > range.end) continue;
      if (rows.has(date)) {
        throw new SyncDataError('Meta devolvió más de un valor de alcance para el mismo día');
      }
      rows.set(date, point.value);
    }
  }

  return [...rows.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({ date, metric: 'reach', value }));
}
