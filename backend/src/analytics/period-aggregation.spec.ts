import { aggregatePeriod, DailyValue, PeriodMetric } from './period-aggregation';

const d = (date: string, metric: string, value: number): DailyValue => ({ date, metric, value });
const find = (result: PeriodMetric[], metric: string) => result.find((r) => r.metric === metric);

describe('aggregatePeriod', () => {
  it('suma las métricas sumables sobre los días con dato', () => {
    const result = aggregatePeriod('YOUTUBE', [
      d('2026-10-18', 'views', 3),
      d('2026-10-19', 'views', 2),
      d('2026-10-18', 'likes', 1),
    ]);
    expect(find(result, 'views')).toEqual({ metric: 'views', value: 5, daysWithData: 2 });
    expect(find(result, 'likes')).toEqual({ metric: 'likes', value: 1, daysWithData: 1 });
  });

  it('no inventa ceros: una métrica sin filas no aparece', () => {
    const result = aggregatePeriod('YOUTUBE', [d('2026-10-18', 'views', 3)]);
    expect(result).toHaveLength(1);
    expect(find(result, 'likes')).toBeUndefined();
  });

  it('un cero real cuenta como día con dato', () => {
    const mixed = aggregatePeriod('YOUTUBE', [
      d('2026-10-18', 'views', 0),
      d('2026-10-19', 'views', 4),
    ]);
    expect(find(mixed, 'views')).toEqual({ metric: 'views', value: 4, daysWithData: 2 });

    const allZero = aggregatePeriod('YOUTUBE', [d('2026-10-18', 'views', 0)]);
    expect(find(allZero, 'views')).toEqual({ metric: 'views', value: 0, daysWithData: 1 });
  });

  it('pondera la duración media por las vistas de cada día', () => {
    const result = aggregatePeriod('YOUTUBE', [
      d('2026-10-18', 'averageViewDuration', 25),
      d('2026-10-19', 'averageViewDuration', 10),
      d('2026-10-18', 'views', 3),
      d('2026-10-19', 'views', 1),
    ]);
    // (25 × 3 + 10 × 1) ÷ 4 = 21,25; el promedio simple (17,5) sería incorrecto.
    expect(find(result, 'averageViewDuration')).toEqual({
      metric: 'averageViewDuration',
      value: 21.25,
      daysWithData: 2,
    });
  });

  it('la media ponderada es null si no hubo vistas', () => {
    const result = aggregatePeriod('YOUTUBE', [
      d('2026-10-18', 'averageViewDuration', 25),
      d('2026-10-18', 'views', 0),
    ]);
    expect(find(result, 'averageViewDuration')).toEqual({
      metric: 'averageViewDuration',
      value: null,
      daysWithData: 1,
    });
  });

  it('la media ponderada ignora los días en los que falta el peso', () => {
    const result = aggregatePeriod('YOUTUBE', [
      d('2026-10-18', 'averageViewDuration', 25),
      d('2026-10-19', 'averageViewDuration', 999),
      d('2026-10-18', 'views', 3),
    ]);
    expect(find(result, 'averageViewDuration')).toEqual({
      metric: 'averageViewDuration',
      value: 25,
      daysWithData: 1,
    });
  });

  it('no agrega los totales puntuales', () => {
    expect(aggregatePeriod('YOUTUBE', [d('2026-10-18', 'subscriberCount', 5)])).toEqual([]);
  });

  it('ignora métricas desconocidas y plataformas sin catálogo', () => {
    expect(aggregatePeriod('YOUTUBE', [d('2026-10-18', 'inventada', 9)])).toEqual([]);
    expect(aggregatePeriod('INSTAGRAM', [d('2026-10-18', 'views', 9)])).toEqual([]);
  });
});