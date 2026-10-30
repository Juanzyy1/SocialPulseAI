import { describe, expect, it } from 'vitest';
import { formatTimestampDate, plural, wholeDaysSince } from './format';

describe('plural', () => {
  it('usa el singular solo con uno', () => {
    expect(plural(1, 'día', 'días')).toBe('1 día');
    expect(plural(0, 'día', 'días')).toBe('0 días');
    expect(plural(7, 'día', 'días')).toBe('7 días');
  });
});

describe('formatTimestampDate', () => {
  it('muestra la fecha local de un instante (se usa el mediodía para no depender de la zona horaria)', () => {
    expect(formatTimestampDate('2026-10-22T12:00:00.000Z')).toBe('22 oct 2026');
  });

  it('devuelve el texto tal cual si no es una fecha válida', () => {
    expect(formatTimestampDate('no-es-fecha')).toBe('no-es-fecha');
  });
});

describe('wholeDaysSince', () => {
  const now = new Date('2026-10-29T12:00:00.000Z');

  it.each([
    ['2026-10-29T11:00:00.000Z', 0],
    ['2026-10-28T13:00:00.000Z', 0],
    ['2026-10-28T12:00:00.000Z', 1],
    ['2026-10-22T12:00:00.000Z', 7],
  ])('desde %s han pasado %i días completos', (iso, days) => {
    expect(wholeDaysSince(iso, now)).toBe(days);
  });

  it('un instante futuro no da días negativos', () => {
    expect(wholeDaysSince('2026-11-05T12:00:00.000Z', now)).toBe(0);
  });

  it('un texto que no es una fecha da null', () => {
    expect(wholeDaysSince('no-es-fecha', now)).toBeNull();
  });
});