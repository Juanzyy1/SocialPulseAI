import {
  dailyMetricCodes,
  getMetricDefinition,
  isCompatibleForGlobalSum,
  metricsOf,
  snapshotMetricCodes,
} from './metric-catalog';

describe('catálogo de métricas', () => {
  const youtube = metricsOf('YOUTUBE');

  it('cada métrica tiene código único, tipo y unidad', () => {
    const codes = youtube.map((m) => m.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const metric of youtube) {
      expect(['additive', 'weighted_average', 'snapshot']).toContain(metric.kind);
      expect(['count', 'minutes', 'seconds']).toContain(metric.unit);
    }
  });

  it('las métricas promediadas se ponderan por una métrica sumable que existe', () => {
    const averaged = youtube.filter((m) => m.kind === 'weighted_average');
    expect(averaged.map((m) => m.code)).toEqual(['averageViewDuration']);
    for (const metric of averaged) {
      expect(getMetricDefinition('YOUTUBE', metric.weightedBy ?? '')?.kind).toBe('additive');
    }
  });

  it('los códigos diarios y los totales puntuales no se solapan', () => {
    const daily = dailyMetricCodes('YOUTUBE');
    const snapshots = snapshotMetricCodes('YOUTUBE');

    expect([...snapshots].sort()).toEqual(['subscriberCount', 'videoCount', 'viewCount']);
    expect([...daily].sort()).toEqual([
      'averageViewDuration',
      'comments',
      'estimatedMinutesWatched',
      'likes',
      'shares',
      'subscribersGained',
      'subscribersLost',
      'views',
    ]);
    expect(daily.filter((code) => snapshots.includes(code))).toEqual([]);
  });

  it('ninguna métrica es compatible entre plataformas todavía', () => {
    expect(youtube.some((m) => isCompatibleForGlobalSum(m))).toBe(false);
  });

  it('una plataforma o una métrica desconocida no tiene definición', () => {
    expect(getMetricDefinition('YOUTUBE', 'noExiste')).toBeUndefined();
    expect(getMetricDefinition('INSTAGRAM', 'views')).toBeUndefined();
    expect(metricsOf('INSTAGRAM')).toEqual([]);
  });

  it('estimatedMinutesWatched advierte que son minutos enteros por día', () => {
    expect(getMetricDefinition('YOUTUBE', 'estimatedMinutesWatched')?.note).toContain('enteros');
  });
});