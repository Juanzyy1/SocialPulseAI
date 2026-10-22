import { compareMetrics, MetricSummary, previousPeriod } from './comparison';

const m = (
  metric: string,
  kind: 'additive' | 'weighted_average',
  value: number | null,
  daysWithData: number,
): MetricSummary => ({ metric, kind, unit: 'count', value, daysWithData, note: null });

describe('previousPeriod', () => {
  it('es inmediatamente anterior y de la misma longitud', () => {
    expect(
      previousPeriod({ kind: '7d', start: '2026-10-13', end: '2026-10-19', days: 7 }),
    ).toEqual({ kind: 'previous', start: '2026-10-06', end: '2026-10-12', days: 7 });
  });

  it('cruza fin de mes y de año', () => {
    expect(
      previousPeriod({ kind: 'custom', start: '2026-01-05', end: '2026-01-11', days: 7 }),
    ).toEqual({ kind: 'previous', start: '2025-12-29', end: '2026-01-04', days: 7 });
  });
});

describe('compareMetrics', () => {
  it('compara las sumables con la misma cobertura: cambio y porcentaje', () => {
    const [result] = compareMetrics([m('views', 'additive', 14, 7)], [m('views', 'additive', 7, 7)]);
    expect(result).toMatchObject({
      comparable: true,
      reasonCode: null,
      reason: null,
      change: 7,
      changePercent: 100,
      current: { value: 14, daysWithData: 7 },
      previous: { value: 7, daysWithData: 7 },
    });
  });

  it('no compara las sumables con distinta cobertura y explica por qué', () => {
    const [result] = compareMetrics([m('views', 'additive', 14, 7)], [m('views', 'additive', 4, 4)]);
    expect(result.comparable).toBe(false);
    expect(result.reasonCode).toBe('DIFFERENT_COVERAGE');
    expect(result.reason).toContain('7 y 4');
    expect(result.change).toBeNull();
    expect(result.changePercent).toBeNull();
  });

  it('un lado sin dato, o una métrica que falta por completo, no es comparable', () => {
    const results = compareMetrics(
      [m('views', 'additive', 14, 7)],
      [m('likes', 'additive', 3, 7)],
    );
    expect(results.map((r) => [r.metric, r.reasonCode, r.comparable])).toEqual([
      ['views', 'MISSING_DATA', false],
      ['likes', 'MISSING_DATA', false],
    ]);
    expect(results[0].previous).toEqual({ value: null, daysWithData: 0 });
    expect(results[1].current).toEqual({ value: null, daysWithData: 0 });
  });

  it('el porcentaje es null si el valor anterior es 0, pero el cambio sí se informa', () => {
    const [result] = compareMetrics([m('views', 'additive', 3, 7)], [m('views', 'additive', 0, 7)]);
    expect(result).toMatchObject({ comparable: true, change: 3, changePercent: null });
  });

  it('un cambio negativo da porcentaje negativo', () => {
    const [result] = compareMetrics([m('views', 'additive', 5, 7)], [m('views', 'additive', 10, 7)]);
    expect(result).toMatchObject({ change: -5, changePercent: -50 });
  });

  it('la media ponderada se compara aunque los periodos tengan distintos días con dato', () => {
    const [result] = compareMetrics(
      [m('averageViewDuration', 'weighted_average', 20, 7)],
      [m('averageViewDuration', 'weighted_average', 10, 3)],
    );
    expect(result).toMatchObject({ comparable: true, change: 10, changePercent: 100 });
  });

  it('la media ponderada sin valor en un lado no es comparable', () => {
    const [result] = compareMetrics(
      [m('averageViewDuration', 'weighted_average', null, 7)],
      [m('averageViewDuration', 'weighted_average', 10, 7)],
    );
    expect(result).toMatchObject({ comparable: false, reasonCode: 'MISSING_DATA', change: null });
  });

  it('conserva el orden: primero las métricas del periodo actual', () => {
    const results = compareMetrics(
      [m('views', 'additive', 1, 7), m('likes', 'additive', 1, 7)],
      [m('shares', 'additive', 1, 7), m('views', 'additive', 1, 7)],
    );
    expect(results.map((r) => r.metric)).toEqual(['views', 'likes', 'shares']);
  });
});