import { describe, expect, it } from 'vitest';
import {
  NO_VALUE,
  formatCount,
  formatDate,
  formatDateRange,
  formatDuration,
  formatMetricValue,
  formatMinutes,
  formatPercent,
  formatSignedValue,
} from './format';

describe('formatCount', () => {
  it.each([
    [0, '0'],
    [7, '7'],
    [999, '999'],
    [1000, '1.000'],
    [1234567, '1.234.567'],
    [2.6, '3'],
    [-1234, '-1.234'],
    [-0.2, '0'],
  ])('%d se muestra como %s', (value, text) => {
    expect(formatCount(value)).toBe(text);
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [25, '0:25'],
    [125, '2:05'],
    [3600, '1:00:00'],
    [3725, '1:02:05'],
    [59.6, '1:00'],
    [-5, '0:00'],
  ])('%d segundos se muestran como %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});

describe('formatMinutes', () => {
  it.each([
    [0, '0 min'],
    [45, '45 min'],
    [60, '1 h'],
    [125, '2 h 5 min'],
    [6000, '100 h'],
    [90000, '1.500 h'],
  ])('%d minutos se muestran como %s', (minutes, text) => {
    expect(formatMinutes(minutes)).toBe(text);
  });
});

describe('formatMetricValue', () => {
  it('un valor ausente se muestra como guion largo', () => {
    expect(formatMetricValue(null, 'count')).toBe(NO_VALUE);
  });

  it('cada unidad usa su formato', () => {
    expect(formatMetricValue(3, 'count')).toBe('3');
    expect(formatMetricValue(25, 'seconds')).toBe('0:25');
    expect(formatMetricValue(125, 'minutes')).toBe('2 h 5 min');
  });
});

describe('formatSignedValue', () => {
  it.each([
    [3, 'count', '+3'],
    [-2, 'count', '-2'],
    [0, 'count', '0'],
    [5, 'seconds', '+0:05'],
    [-65, 'seconds', '-1:05'],
  ] as const)('%d (%s) se muestra como %s', (change, unit, text) => {
    expect(formatSignedValue(change, unit)).toBe(text);
  });
});

describe('formatPercent', () => {
  it.each([
    [28.44, '+28,4 %'],
    [-12.6, '-12,6 %'],
    [0, '0,0 %'],
    [100, '+100,0 %'],
  ])('%d se muestra como %s', (value, text) => {
    expect(formatPercent(value)).toBe(text);
  });
});

describe('formatDate y formatDateRange', () => {
  it('convierte una fecha ISO a texto en español', () => {
    expect(formatDate('2026-10-19')).toBe('19 oct 2026');
    expect(formatDate('2026-01-05')).toBe('5 ene 2026');
    expect(formatDate('2026-12-31')).toBe('31 dic 2026');
  });

  it('devuelve el texto tal cual si no es una fecha válida', () => {
    expect(formatDate('no-es-fecha')).toBe('no-es-fecha');
    expect(formatDate('2026-13-01')).toBe('2026-13-01');
  });

  it('un rango de un solo día muestra una fecha; uno de varios, las dos', () => {
    expect(formatDateRange('2026-10-19', '2026-10-19')).toBe('19 oct 2026');
    expect(formatDateRange('2026-09-20', '2026-10-19')).toBe('20 sep 2026 – 19 oct 2026');
  });
});