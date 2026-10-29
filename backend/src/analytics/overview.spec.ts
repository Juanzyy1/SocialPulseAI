import type { MetricSummary } from './comparison';
import type { MetricDefinition } from './metric-catalog';
import {
  CombinedMetric,
  combineSamePlatform,
  DefinitionLookup,
  sumCompatibleAcrossPlatforms,
} from './overview';

const def = (
  code: string,
  kind: MetricDefinition['kind'],
  extra: Partial<MetricDefinition> = {},
): MetricDefinition => ({
  code,
  label: code,
  kind,
  unit: 'count',
  polarity: 'neutral',
  compatibleGroup: null,
  ...extra,
});

const metric = (code: string, kind: string, value: number | null): MetricSummary => ({
  metric: code,
  kind,
  unit: 'count',
  value,
  daysWithData: 7,
  note: null,
});

describe('combineSamePlatform', () => {
  const defs: Record<string, MetricDefinition> = {
    'YT|views': def('views', 'additive'),
    'YT|avg': def('avg', 'weighted_average', { unit: 'seconds', weightedBy: 'views', note: 'ponderada' }),
    'YT|subs': def('subs', 'snapshot'),
  };
  const lookup: DefinitionLookup = (platform, code) => defs[`${platform}|${code}`];
  const find = (result: CombinedMetric[], code: string) => result.find((r) => r.metric === code);

  it('suma las métricas sumables de varias cuentas', () => {
    const result = combineSamePlatform(
      'YT',
      [
        { metrics: [metric('views', 'additive', 3)] },
        { metrics: [metric('views', 'additive', 1)] },
      ],
      lookup,
    );
    expect(find(result, 'views')).toMatchObject({ value: 4, accountsIncluded: 2, kind: 'additive' });
  });

  it('ignora las cuentas sin valor y cuenta solo las que intervinieron', () => {
    const result = combineSamePlatform(
      'YT',
      [
        { metrics: [metric('views', 'additive', 3)] },
        { metrics: [metric('views', 'additive', null)] },
        { metrics: [] },
      ],
      lookup,
    );
    expect(find(result, 'views')).toMatchObject({ value: 3, accountsIncluded: 1 });
  });

  it('pondera la media por las vistas de cada cuenta, no por un promedio simple', () => {
    const result = combineSamePlatform(
      'YT',
      [
        { metrics: [metric('views', 'additive', 3), metric('avg', 'weighted_average', 25)] },
        { metrics: [metric('views', 'additive', 1), metric('avg', 'weighted_average', 10)] },
      ],
      lookup,
    );
    // (25 × 3 + 10 × 1) ÷ 4 = 21,25; el promedio simple (17,5) sería incorrecto.
    expect(find(result, 'avg')).toMatchObject({ value: 21.25, accountsIncluded: 2, note: 'ponderada' });
  });

  it('una cuenta con media pero sin vistas no interviene en la media', () => {
    const result = combineSamePlatform(
      'YT',
      [
        { metrics: [metric('views', 'additive', 3), metric('avg', 'weighted_average', 25)] },
        { metrics: [metric('avg', 'weighted_average', 10)] },
      ],
      lookup,
    );
    expect(find(result, 'avg')).toMatchObject({ value: 25, accountsIncluded: 1 });
  });

  it('no combina los totales puntuales ni las métricas desconocidas', () => {
    const result = combineSamePlatform(
      'YT',
      [{ metrics: [metric('subs', 'snapshot', 5), metric('inventada', 'additive', 9)] }],
      lookup,
    );
    expect(result).toEqual([]);
  });

  it('devuelve null cuando ninguna cuenta aporta valor', () => {
    const result = combineSamePlatform(
      'YT',
      [
        { metrics: [metric('views', 'additive', null), metric('avg', 'weighted_average', null)] },
      ],
      lookup,
    );
    expect(find(result, 'views')).toMatchObject({ value: null, accountsIncluded: 0 });
    expect(find(result, 'avg')).toMatchObject({ value: null, accountsIncluded: 0 });
  });
});

describe('sumCompatibleAcrossPlatforms', () => {
  const defs: Record<string, MetricDefinition> = {
    'A|views': def('views', 'additive', { compatibleGroup: 'plays' }),
    'A|likes': def('likes', 'additive'),
    'B|plays': def('plays', 'additive', { compatibleGroup: 'plays' }),
    'B|plays2': def('plays2', 'additive', { compatibleGroup: 'plays' }),
    'B|likes': def('likes', 'additive'),
    'C|minutes': def('minutes', 'additive', { unit: 'minutes', compatibleGroup: 'plays' }),
  };
  const lookup: DefinitionLookup = (platform, code) => defs[`${platform}|${code}`];
  const combined = (code: string, value: number | null): CombinedMetric => ({
    metric: code,
    kind: 'additive',
    unit: 'count',
    value,
    accountsIncluded: 1,
    note: null,
  });

  it('suma solo las métricas del mismo grupo compatible en 2 o más plataformas', () => {
    const groups = sumCompatibleAcrossPlatforms(
      [
        { platform: 'A', metrics: [combined('views', 10), combined('likes', 5)] },
        { platform: 'B', metrics: [combined('plays', 4), combined('likes', 2)] },
      ],
      lookup,
    );
    // Los "me gusta" no son compatibles (sin grupo): no se suman aunque se llamen igual.
    expect(groups).toEqual([{ group: 'plays', unit: 'count', value: 14, platforms: ['A', 'B'] }]);
  });

  it('un grupo con una sola plataforma no se devuelve', () => {
    expect(
      sumCompatibleAcrossPlatforms([{ platform: 'A', metrics: [combined('views', 10)] }], lookup),
    ).toEqual([]);
  });

  it('una métrica sin valor no cuenta como plataforma que aporta', () => {
    expect(
      sumCompatibleAcrossPlatforms(
        [
          { platform: 'A', metrics: [combined('views', 10)] },
          { platform: 'B', metrics: [combined('plays', null)] },
        ],
        lookup,
      ),
    ).toEqual([]);
  });

  it('se descarta un grupo que mezcla unidades distintas', () => {
    expect(
      sumCompatibleAcrossPlatforms(
        [
          { platform: 'A', metrics: [combined('views', 10)] },
          { platform: 'C', metrics: [combined('minutes', 3)] },
        ],
        lookup,
      ),
    ).toEqual([]);
  });

  it('se descarta un grupo donde una misma plataforma aporta dos métricas (duplicaría)', () => {
    expect(
      sumCompatibleAcrossPlatforms(
        [
          { platform: 'A', metrics: [combined('views', 10)] },
          { platform: 'B', metrics: [combined('plays', 4), combined('plays2', 4)] },
        ],
        lookup,
      ),
    ).toEqual([]);
  });
});