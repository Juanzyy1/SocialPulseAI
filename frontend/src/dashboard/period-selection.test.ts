import { describe, expect, it } from 'vitest';
import {
  customRangeError,
  describeSelection,
  parseSelection,
  presetSelection,
  selectionKey,
  selectionQuery,
  withSelection,
} from './period-selection';

const TODAY = '2026-10-22';
const parse = (query: string) => parseSelection(new URLSearchParams(query), TODAY);

describe('customRangeError', () => {
  it('acepta un rango válido, incluido un solo día y hoy', () => {
    expect(customRangeError('2026-10-01', '2026-10-15', TODAY)).toBeNull();
    expect(customRangeError('2026-10-22', '2026-10-22', TODAY)).toBeNull();
  });

  it('pide las dos fechas', () => {
    expect(customRangeError('', '2026-10-15', TODAY)).toBe('Elige la fecha inicial y la final');
    expect(customRangeError('2026-10-01', '', TODAY)).toBe('Elige la fecha inicial y la final');
  });

  it('rechaza fechas que no existen o con otro formato', () => {
    expect(customRangeError('2026-02-30', '2026-03-01', TODAY)).toBe('Las fechas no son válidas');
    expect(customRangeError('20261001', '2026-10-15', TODAY)).toBe('Las fechas no son válidas');
  });

  it('rechaza un inicio posterior al fin', () => {
    expect(customRangeError('2026-10-15', '2026-10-01', TODAY)).toBe(
      'La fecha inicial no puede ser posterior a la final',
    );
  });

  it('rechaza un fin posterior a hoy', () => {
    expect(customRangeError('2026-10-20', '2026-10-23', TODAY)).toBe(
      'La fecha final no puede ser posterior a hoy',
    );
  });

  it('acepta exactamente 366 días y rechaza 367', () => {
    expect(customRangeError('2025-10-22', TODAY, TODAY)).toBeNull();
    expect(customRangeError('2025-10-21', TODAY, TODAY)).toBe('El rango no puede superar 366 días');
  });
});

describe('parseSelection', () => {
  it('sin parámetros usa 30 días', () => {
    expect(parse('')).toEqual({ kind: 'preset', period: '30d' });
  });

  it('lee un periodo predefinido y trata uno desconocido como 30 días', () => {
    expect(parse('period=7d')).toEqual({ kind: 'preset', period: '7d' });
    expect(parse('period=14d')).toEqual({ kind: 'preset', period: '30d' });
  });

  it('lee un rango personalizado válido', () => {
    expect(parse('from=2026-10-01&to=2026-10-15')).toEqual({
      kind: 'custom',
      from: '2026-10-01',
      to: '2026-10-15',
    });
  });

  it('un rango inválido o incompleto vuelve a 30 días, aunque venga con un periodo válido', () => {
    for (const query of [
      'from=2026-13-01&to=2026-10-15',
      'from=2026-10-01',
      'to=2026-10-15',
      'from=2026-10-20&to=2026-10-23',
      'from=2026-10-15&to=2026-10-01',
      'from=2025-01-01&to=2026-10-01',
      'from=&to=',
      'period=7d&from=2026-10-20&to=2026-10-23',
    ]) {
      expect(parse(query)).toEqual({ kind: 'preset', period: '30d' });
    }
  });

  it('si hay un rango válido junto con un periodo, gana el rango', () => {
    expect(parse('period=7d&from=2026-10-01&to=2026-10-15').kind).toBe('custom');
  });
});

describe('withSelection', () => {
  it('pasar a un periodo predefinido quita las fechas y conserva el resto', () => {
    const result = withSelection(
      new URLSearchParams('from=2026-10-01&to=2026-10-15&account=abc'),
      presetSelection('7d'),
    );

    expect(result.get('period')).toBe('7d');
    expect(result.has('from')).toBe(false);
    expect(result.has('to')).toBe(false);
    expect(result.get('account')).toBe('abc');
  });

  it('pasar a un rango quita el periodo y conserva el resto', () => {
    const result = withSelection(new URLSearchParams('period=7d&account=abc'), {
      kind: 'custom',
      from: '2026-10-01',
      to: '2026-10-15',
    });

    expect(result.has('period')).toBe(false);
    expect(result.get('from')).toBe('2026-10-01');
    expect(result.get('to')).toBe('2026-10-15');
    expect(result.get('account')).toBe('abc');
  });

  it('no modifica los parámetros originales', () => {
    const original = new URLSearchParams('period=7d');

    withSelection(original, { kind: 'custom', from: '2026-10-01', to: '2026-10-15' });

    expect(original.toString()).toBe('period=7d');
  });
});

describe('selectionQuery, selectionKey y describeSelection', () => {
  const custom = { kind: 'custom', from: '2026-10-01', to: '2026-10-15' } as const;

  it('la petición lleva el periodo o las fechas, nunca ambos', () => {
    expect(selectionQuery(presetSelection('90d'))).toBe('period=90d');
    expect(selectionQuery(custom)).toBe('from=2026-10-01&to=2026-10-15');
  });

  it('la clave distingue cada selección', () => {
    expect(selectionKey(presetSelection('7d'))).toBe('7d');
    expect(selectionKey(custom)).toBe('2026-10-01..2026-10-15');
  });

  it('describe la selección en español', () => {
    expect(describeSelection(presetSelection('30d'))).toBe('Últimos 30 días');
    expect(describeSelection(custom)).toBe('1 oct 2026 – 15 oct 2026');
  });
});