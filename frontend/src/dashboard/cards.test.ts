import { describe, expect, it } from 'vitest';
import type {
  CatalogMetric,
  ComparisonResponse,
  MetricComparison,
  PeriodSummary,
  TotalValue,
} from '../api/types';
import { buildMetricCards, buildTotals } from './cards';

const views: CatalogMetric = {
  code: 'views',
  label: 'Vistas',
  kind: 'additive',
  unit: 'count',
  polarity: 'higher_is_better',
  note: null,
};
const duration: CatalogMetric = {
  code: 'averageViewDuration',
  label: 'Duración media',
  kind: 'weighted_average',
  unit: 'seconds',
  polarity: 'higher_is_better',
  note: 'ponderada',
};
const lost: CatalogMetric = {
  code: 'subscribersLost',
  label: 'Suscriptores perdidos',
  kind: 'additive',
  unit: 'count',
  polarity: 'lower_is_better',
  note: null,
};
const subscribers: CatalogMetric = {
  code: 'subscriberCount',
  label: 'Suscriptores',
  kind: 'snapshot',
  unit: 'count',
  polarity: 'neutral',
  note: 'redondeado',
};
const videos: CatalogMetric = { ...subscribers, code: 'videoCount', label: 'Videos', note: null };
const catalog = [views, duration, lost, subscribers, videos];

const summary: PeriodSummary = {
  period: { kind: '7d', start: '2026-10-13', end: '2026-10-19', days: 7 },
  coverage: { daysWithData: 7, missingDays: 0, missingRanges: [] },
};

function metricComparison(
  metric: string,
  current: number | null,
  previous: number | null,
  overrides: Partial<MetricComparison> = {},
): MetricComparison {
  const change = current !== null && previous !== null ? current - previous : null;
  return {
    metric,
    kind: 'additive',
    unit: 'count',
    note: null,
    current: { value: current, daysWithData: current === null ? 0 : 7 },
    previous: { value: previous, daysWithData: previous === null ? 0 : 7 },
    comparable: change !== null,
    reasonCode: null,
    reason: null,
    change,
    changePercent:
      change !== null && previous !== null && previous !== 0 ? (change / Math.abs(previous)) * 100 : null,
    ...overrides,
  };
}

const comparison = (
  metrics: MetricComparison[],
  current: PeriodSummary | null = summary,
): ComparisonResponse => ({
  account: { id: 'cuenta-1', platform: 'YOUTUBE', displayName: 'Canal', status: 'ACTIVE' },
  dataThrough: '2026-10-19',
  daysBehind: 3,
  current,
  previous: current,
  comparable: true,
  message: null,
  metrics,
});

const onlyCard = (metrics: MetricComparison[], definition: CatalogMetric = views) => {
  const [card] = buildMetricCards([definition], comparison(metrics));
  if (!card) throw new Error('No se generó la tarjeta');
  return card;
};

describe('buildMetricCards', () => {
  it('sin datos en el periodo no hay tarjetas', () => {
    expect(buildMetricCards(catalog, comparison([], null))).toEqual([]);
  });

  it('genera solo las métricas diarias, en el orden del catálogo', () => {
    const cards = buildMetricCards(
      catalog,
      comparison([metricComparison('subscribersLost', 0, 0), metricComparison('views', 3, 3)]),
    );

    expect(cards.map((card) => card.code)).toEqual(['views', 'averageViewDuration', 'subscribersLost']);
  });

  it('un aumento de una métrica "mejor si sube" es bueno, con signo, porcentaje y valor anterior', () => {
    const card = onlyCard([metricComparison('views', 9, 6)]);

    expect(card).toMatchObject({ valueText: '9', hasValue: true, daysWithData: 7 });
    expect(card.delta).toEqual({
      kind: 'up',
      tone: 'good',
      changeText: '+3',
      percentText: '+50,0 %',
      previousText: 'Antes: 6',
      reason: null,
    });
  });

  it('una bajada de una métrica "mejor si sube" es mala', () => {
    const { delta } = onlyCard([metricComparison('views', 3, 6)]);

    expect(delta).toMatchObject({ kind: 'down', tone: 'bad', changeText: '-3', percentText: '-50,0 %' });
  });

  it('en una métrica "mejor si baja", subir es malo y bajar es bueno', () => {
    expect(onlyCard([metricComparison('subscribersLost', 4, 2)], lost).delta).toMatchObject({
      kind: 'up',
      tone: 'bad',
    });
    expect(onlyCard([metricComparison('subscribersLost', 1, 2)], lost).delta).toMatchObject({
      kind: 'down',
      tone: 'good',
    });
  });

  it('una métrica neutral nunca es buena ni mala', () => {
    const neutral = { ...views, polarity: 'neutral' as const };

    expect(onlyCard([metricComparison('views', 9, 6)], neutral).delta.tone).toBe('neutral');
    expect(onlyCard([metricComparison('views', 3, 6)], neutral).delta.tone).toBe('neutral');
  });

  it('una variación de cero es "Sin cambios", neutral y sin porcentaje', () => {
    expect(onlyCard([metricComparison('views', 5, 5)]).delta).toEqual({
      kind: 'flat',
      tone: 'neutral',
      changeText: 'Sin cambios',
      percentText: null,
      previousText: 'Antes: 5',
      reason: null,
    });
  });

  it('si el valor anterior era 0 no hay porcentaje, pero sí la variación y el valor anterior', () => {
    expect(onlyCard([metricComparison('views', 3, 0)]).delta).toEqual({
      kind: 'up',
      tone: 'good',
      changeText: '+3',
      percentText: null,
      previousText: 'Antes: 0',
      reason: null,
    });
  });

  it('una métrica no comparable lo dice y explica el motivo del backend', () => {
    const card = onlyCard([
      metricComparison('views', 14, 4, {
        comparable: false,
        reasonCode: 'DIFFERENT_COVERAGE',
        reason: 'Los periodos tienen distinto número de días con dato (7 y 4)',
        change: null,
        changePercent: null,
      }),
    ]);

    expect(card.valueText).toBe('14');
    expect(card.delta).toEqual({
      kind: 'none',
      tone: 'neutral',
      changeText: 'No comparable',
      percentText: null,
      previousText: 'Antes: 4',
      reason: 'Los periodos tienen distinto número de días con dato (7 y 4)',
    });
  });

  it('la duración media sin valor anterior no es comparable y no muestra "Antes"', () => {
    const card = onlyCard(
      [
        metricComparison('averageViewDuration', 25, null, {
          kind: 'weighted_average',
          unit: 'seconds',
          reasonCode: 'MISSING_DATA',
          reason: 'La media no se puede calcular en uno de los dos periodos',
        }),
      ],
      duration,
    );

    expect(card.valueText).toBe('0:25');
    expect(card.delta).toMatchObject({ kind: 'none', previousText: null });
    expect(card.delta.reason).toContain('no se puede calcular');
  });

  it('una métrica sin valor muestra "Sin dato", nunca un cero', () => {
    const card = onlyCard([metricComparison('views', null, 5)]);

    expect(card).toMatchObject({ valueText: 'Sin dato', hasValue: false, daysWithData: 0 });
    expect(card.delta.previousText).toBe('Antes: 5');
  });

  it('una métrica ausente de la respuesta aparece como "Sin dato" y sin comparación', () => {
    const [card] = buildMetricCards([views], comparison([]));

    expect(card).toMatchObject({ valueText: 'Sin dato', hasValue: false });
    expect(card?.delta).toMatchObject({ kind: 'none', changeText: 'Sin comparación', previousText: null });
  });

  it('ignora las métricas de la respuesta que no están en el catálogo', () => {
    const cards = buildMetricCards([views], comparison([metricComparison('inventada', 9, 1)]));

    expect(cards.map((card) => card.code)).toEqual(['views']);
  });

  it('lleva la etiqueta y la advertencia del catálogo', () => {
    const card = onlyCard([metricComparison('averageViewDuration', 25, 20)], duration);

    expect(card).toMatchObject({ label: 'Duración media', note: 'ponderada' });
  });
});

describe('buildTotals', () => {
  const total = (metric: string, value: number, capturedOn = '2026-10-22'): TotalValue => ({
    metric,
    unit: 'count',
    value,
    capturedOn,
    note: null,
  });

  it('devuelve solo los totales puntuales, en el orden del catálogo, con etiqueta, fecha y advertencia', () => {
    const result = buildTotals(catalog, [total('videoCount', 1), total('subscriberCount', 1234)]);

    expect(result).toEqual([
      {
        code: 'subscriberCount',
        label: 'Suscriptores',
        valueText: '1.234',
        capturedOn: '22 oct 2026',
        note: 'redondeado',
      },
      { code: 'videoCount', label: 'Videos', valueText: '1', capturedOn: '22 oct 2026', note: null },
    ]);
  });

  it('ignora lo que no está en el catálogo y no genera tarjetas para totales ausentes', () => {
    expect(buildTotals(catalog, [total('inventada', 9)])).toEqual([]);
    expect(buildTotals(catalog, [])).toEqual([]);
  });
});