import {
  dailyMetricCodes,
  describeCatalog,
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

  it('cada métrica tiene una etiqueta en español, no vacía, única y distinta de su código', () => {
    const labels = youtube.map((m) => m.label);

    expect(new Set(labels).size).toBe(labels.length);
    for (const metric of youtube) {
      expect(metric.label.trim()).not.toBe('');
      expect(metric.label).not.toBe(metric.code);
    }
  });

  it('solo las bajas de suscriptores son "mejor si bajan"; los totales puntuales son neutrales', () => {
    const lowerIsBetter = youtube.filter((m) => m.polarity === 'lower_is_better');
    expect(lowerIsBetter.map((m) => m.code)).toEqual(['subscribersLost']);

    for (const metric of youtube.filter((m) => m.kind === 'snapshot')) {
      expect(metric.polarity).toBe('neutral');
    }
    for (const metric of youtube.filter((m) => m.kind !== 'snapshot' && m.code !== 'subscribersLost')) {
      expect(metric.polarity).toBe('higher_is_better');
    }
  });
});

describe('describeCatalog', () => {
  it('lista las plataformas con catálogo y todas sus métricas, en orden', () => {
    const catalog = describeCatalog();

    expect(catalog.map((p) => p.platform)).toEqual(['YOUTUBE']);
    expect(catalog[0].metrics.map((m) => m.code)).toEqual(metricsOf('YOUTUBE').map((m) => m.code));
  });

  it('entrega solo los campos públicos, sin datos internos de agregación', () => {
    for (const metric of describeCatalog()[0].metrics) {
      expect(Object.keys(metric).sort()).toEqual(['code', 'kind', 'label', 'note', 'polarity', 'unit']);
    }
    const views = describeCatalog()[0].metrics.find((m) => m.code === 'views');
    expect(views).toMatchObject({ label: 'Vistas', polarity: 'higher_is_better', note: null });
  });

  it('devuelve copias: modificar el resultado no altera el catálogo', () => {
    const first = describeCatalog();
    first[0].metrics[0].label = 'MODIFICADO';
    first[0].metrics.length = 0;

    const second = describeCatalog();
    expect(second[0].metrics[0].label).toBe('Vistas');
    expect(second[0].metrics.length).toBeGreaterThan(0);
  });
});