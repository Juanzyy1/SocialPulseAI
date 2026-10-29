import { describe, expect, it } from 'vitest';
import { DEFAULT_PERIOD, PERIOD_OPTIONS, parsePeriod, withPeriod } from './period-params';

describe('parsePeriod', () => {
  it('acepta los tres periodos predefinidos', () => {
    expect(parsePeriod('7d')).toBe('7d');
    expect(parsePeriod('30d')).toBe('30d');
    expect(parsePeriod('90d')).toBe('90d');
  });

  it('usa el predeterminado si falta o es desconocido, incluidas variantes de mayúsculas o espacios', () => {
    for (const value of [null, '', '14d', '30D', ' 30d', '30d ', '1d', 'abc']) {
      expect(parsePeriod(value)).toBe(DEFAULT_PERIOD);
    }
  });
});

describe('withPeriod', () => {
  it('añade o reemplaza el periodo y conserva los demás parámetros', () => {
    const result = withPeriod(new URLSearchParams('period=7d&cuenta=abc'), '90d');

    expect(result.get('period')).toBe('90d');
    expect(result.get('cuenta')).toBe('abc');
    expect(withPeriod(new URLSearchParams(), '7d').toString()).toBe('period=7d');
  });

  it('no modifica los parámetros originales', () => {
    const original = new URLSearchParams('period=7d');

    withPeriod(original, '90d');

    expect(original.get('period')).toBe('7d');
  });
});

describe('PERIOD_OPTIONS', () => {
  it('tiene los tres periodos con etiquetas en español, y el predeterminado es uno de ellos', () => {
    expect(PERIOD_OPTIONS.map((option) => option.value)).toEqual(['7d', '30d', '90d']);
    expect(PERIOD_OPTIONS.map((option) => option.label)).toEqual(['7 días', '30 días', '90 días']);
    expect(PERIOD_OPTIONS.some((option) => option.value === DEFAULT_PERIOD)).toBe(true);
  });
});