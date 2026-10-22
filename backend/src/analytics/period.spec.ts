import {
  countDays,
  parsePeriodRequest,
  resolvePeriod,
  summarizeCoverage,
} from './period';

const TODAY = '2026-10-22';
const parse = (input: { period?: string; from?: string; to?: string }) =>
  parsePeriodRequest(input, TODAY);
const errorOf = (input: { period?: string; from?: string; to?: string }): string => {
  const result = parse(input);
  return result.ok ? '' : result.error;
};

describe('parsePeriodRequest', () => {
  it('sin parámetros usa 30 días', () => {
    expect(parse({})).toEqual({ ok: true, request: { kind: '30d' } });
  });

  it('acepta los tres periodos predefinidos', () => {
    for (const period of ['7d', '30d', '90d']) {
      expect(parse({ period })).toEqual({ ok: true, request: { kind: period } });
    }
  });

  it('rechaza un period desconocido', () => {
    expect(errorOf({ period: '14d' })).toContain('period');
  });

  it('rechaza period junto con from o to', () => {
    expect(errorOf({ period: '7d', from: '2026-10-01', to: '2026-10-02' })).toContain('no ambos');
    expect(errorOf({ period: '7d', from: '2026-10-01' })).toContain('no ambos');
  });

  it('rechaza from o to por separado', () => {
    expect(errorOf({ from: '2026-10-01' })).toContain('juntos');
    expect(errorOf({ to: '2026-10-01' })).toContain('juntos');
  });

  it('rechaza fechas con formato inválido o que no existen', () => {
    expect(errorOf({ from: '2026-02-30', to: '2026-03-01' })).toContain('fechas reales');
    expect(errorOf({ from: '20261001', to: '2026-10-02' })).toContain('fechas reales');
  });

  it('rechaza un from posterior a to', () => {
    expect(errorOf({ from: '2026-10-05', to: '2026-10-01' })).toContain('posterior');
  });

  it('rechaza un to posterior a hoy', () => {
    expect(errorOf({ from: '2026-10-20', to: '2026-10-23' })).toContain('hoy');
  });

  it('rechaza rangos de más de 366 días y acepta exactamente 366', () => {
    expect(errorOf({ from: '2025-01-01', to: '2026-10-01' })).toContain('366');
    expect(parse({ from: '2025-10-22', to: '2026-10-22' }).ok).toBe(true); // 366 días
  });

  it('acepta un rango personalizado válido, incluido un solo día', () => {
    expect(parse({ from: '2026-10-01', to: '2026-10-07' })).toEqual({
      ok: true,
      request: { kind: 'custom', from: '2026-10-01', to: '2026-10-07' },
    });
    expect(parse({ from: TODAY, to: TODAY }).ok).toBe(true);
  });
});

describe('resolvePeriod', () => {
  it('un periodo predefinido termina en el último día con dato', () => {
    expect(resolvePeriod({ kind: '7d' }, '2026-10-19')).toEqual({
      kind: '7d',
      start: '2026-10-13',
      end: '2026-10-19',
      days: 7,
    });
    expect(resolvePeriod({ kind: '90d' }, '2026-10-19')).toMatchObject({
      start: '2026-07-22',
      days: 90,
    });
  });

  it('sin datos, un periodo predefinido no se puede resolver', () => {
    expect(resolvePeriod({ kind: '30d' }, null)).toBeNull();
  });

  it('un rango personalizado se respeta tal cual, con o sin datos', () => {
    const request = { kind: 'custom' as const, from: '2026-10-01', to: '2026-10-10' };
    const expected = { kind: 'custom', start: '2026-10-01', end: '2026-10-10', days: 10 };
    expect(resolvePeriod(request, null)).toEqual(expected);
    expect(resolvePeriod(request, '2026-10-05')).toEqual(expected);
  });
});

describe('countDays', () => {
  it('cuenta ambos extremos y cruza meses', () => {
    expect(countDays('2026-10-01', '2026-10-01')).toBe(1);
    expect(countDays('2026-09-28', '2026-10-03')).toBe(6);
  });
});

describe('summarizeCoverage', () => {
  it('sin huecos no falta ningún día', () => {
    expect(summarizeCoverage('2026-10-01', '2026-10-03', new Set(['2026-10-01', '2026-10-02', '2026-10-03']))).toEqual({
      daysWithData: 3,
      missingDays: 0,
      missingRanges: [],
    });
  });

  it('agrupa los días ausentes en tramos: al inicio, en medio y al final', () => {
    const withData = new Set(['2026-10-03', '2026-10-06']);
    expect(summarizeCoverage('2026-10-01', '2026-10-08', withData)).toEqual({
      daysWithData: 2,
      missingDays: 6,
      missingRanges: [
        { from: '2026-10-01', to: '2026-10-02' },
        { from: '2026-10-04', to: '2026-10-05' },
        { from: '2026-10-07', to: '2026-10-08' },
      ],
    });
  });

  it('si no hay ningún dato, todo el rango es un solo tramo ausente', () => {
    expect(summarizeCoverage('2026-10-01', '2026-10-03', new Set())).toEqual({
      daysWithData: 0,
      missingDays: 3,
      missingRanges: [{ from: '2026-10-01', to: '2026-10-03' }],
    });
  });
});