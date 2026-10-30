import type {
  CatalogMetric,
  ComparisonResponse,
  MetricComparison,
  MetricPolarity,
  MetricUnit,
  TotalValue,
} from '../api/types';
import { formatDate, formatMetricValue, formatPercent, formatSignedValue } from './format';

export type DeltaKind = 'up' | 'down' | 'flat' | 'none';
export type DeltaTone = 'good' | 'bad' | 'neutral';

export const NO_DATA_TEXT = 'Sin dato';

export interface DeltaModel {
  kind: DeltaKind;
  /** Bueno, malo o neutral según la polaridad de la métrica (que bajen las bajas es bueno). */
  tone: DeltaTone;
  changeText: string;
  percentText: string | null;
  previousText: string | null;
  reason: string | null;
}

export interface MetricCardModel {
  code: string;
  label: string;
  unit: MetricUnit;
  note: string | null;
  valueText: string;
  hasValue: boolean;
  daysWithData: number;
  delta: DeltaModel;
}

export interface TotalCardModel {
  code: string;
  label: string;
  valueText: string;
  capturedOn: string;
  note: string | null;
}

function toneFor(direction: 'up' | 'down', polarity: MetricPolarity): DeltaTone {
  if (polarity === 'neutral') return 'neutral';
  const good = polarity === 'higher_is_better' ? 'up' : 'down';
  return direction === good ? 'good' : 'bad';
}

function previousTextOf(comparison: MetricComparison, unit: MetricUnit): string | null {
  const { value } = comparison.previous;
  return value === null ? null : `Antes: ${formatMetricValue(value, unit)}`;
}

function buildDelta(
  comparison: MetricComparison | undefined,
  polarity: MetricPolarity,
  unit: MetricUnit,
): DeltaModel {
  if (!comparison) {
    return {
      kind: 'none',
      tone: 'neutral',
      changeText: 'Sin comparación',
      percentText: null,
      previousText: null,
      reason: null,
    };
  }

  const previousText = previousTextOf(comparison, unit);
  const { change } = comparison;
  if (!comparison.comparable || change === null) {
    return {
      kind: 'none',
      tone: 'neutral',
      changeText: 'No comparable',
      percentText: null,
      previousText,
      reason: comparison.reason,
    };
  }
  if (change === 0) {
    return {
      kind: 'flat',
      tone: 'neutral',
      changeText: 'Sin cambios',
      percentText: null,
      previousText,
      reason: null,
    };
  }

  const direction = change > 0 ? 'up' : 'down';
  return {
    kind: direction,
    tone: toneFor(direction, polarity),
    changeText: formatSignedValue(change, unit),
    // Si el valor anterior era 0, el backend no calcula porcentaje: no se inventa.
    percentText: comparison.changePercent === null ? null : formatPercent(comparison.changePercent),
    previousText,
    reason: null,
  };
}

/**
 * Tarjetas de las métricas diarias, en el orden del catálogo. Sin ningún dato en el periodo no hay
 * tarjetas (la pantalla muestra un estado vacío). Una métrica que falta en la respuesta aparece
 * como "Sin dato": nunca como un cero.
 */
export function buildMetricCards(
  catalog: readonly CatalogMetric[],
  comparison: ComparisonResponse,
): MetricCardModel[] {
  if (comparison.current === null) return [];

  return catalog
    .filter((definition) => definition.kind !== 'snapshot')
    .map((definition) => {
      const found = comparison.metrics.find((metric) => metric.metric === definition.code);
      const value = found?.current.value ?? null;
      const daysWithData = found?.current.daysWithData ?? 0;
      const hasValue = value !== null && daysWithData > 0;

      return {
        code: definition.code,
        label: definition.label,
        unit: definition.unit,
        note: definition.note,
        valueText: hasValue ? formatMetricValue(value, definition.unit) : NO_DATA_TEXT,
        hasValue,
        daysWithData,
        delta: buildDelta(found, definition.polarity, definition.unit),
      };
    });
}

/** Totales puntuales (suscriptores, vistas totales, videos), en el orden del catálogo. */
export function buildTotals(
  catalog: readonly CatalogMetric[],
  totals: readonly TotalValue[],
): TotalCardModel[] {
  return catalog
    .filter((definition) => definition.kind === 'snapshot')
    .flatMap((definition) => {
      const total = totals.find((item) => item.metric === definition.code);
      if (!total) return [];
      return [
        {
          code: definition.code,
          label: definition.label,
          valueText: formatMetricValue(total.value, definition.unit),
          capturedOn: formatDate(total.capturedOn),
          note: definition.note,
        },
      ];
    });
}