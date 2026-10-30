import { describe, expect, it } from 'vitest';
import { countDays, isRealIsoDay, pacificToday } from './dates';

describe('pacificToday', () => {
  it('en verano (UTC-7) el día cambia a las 07:00 UTC', () => {
    expect(pacificToday(new Date('2026-10-19T06:59:59Z'))).toBe('2026-10-18');
    expect(pacificToday(new Date('2026-10-19T07:00:00Z'))).toBe('2026-10-19');
  });

  it('en invierno (UTC-8) el día cambia a las 08:00 UTC', () => {
    expect(pacificToday(new Date('2026-12-01T07:59:59Z'))).toBe('2026-11-30');
    expect(pacificToday(new Date('2026-12-01T08:00:00Z'))).toBe('2026-12-01');
  });

  it('el 8 de marzo de 2026 (empieza el horario de verano) el límite pasa de 08:00 a 07:00 UTC', () => {
    expect(pacificToday(new Date('2026-03-08T07:59:59Z'))).toBe('2026-03-07');
    expect(pacificToday(new Date('2026-03-08T08:00:00Z'))).toBe('2026-03-08');
    expect(pacificToday(new Date('2026-03-09T06:59:59Z'))).toBe('2026-03-08');
    expect(pacificToday(new Date('2026-03-09T07:00:00Z'))).toBe('2026-03-09');
  });

  it('el 1 de noviembre de 2026 (termina el horario de verano) el día dura 25 horas', () => {
    expect(pacificToday(new Date('2026-11-01T06:59:59Z'))).toBe('2026-10-31');
    expect(pacificToday(new Date('2026-11-01T07:00:00Z'))).toBe('2026-11-01');
    expect(pacificToday(new Date('2026-11-02T07:59:59Z'))).toBe('2026-11-01');
    expect(pacificToday(new Date('2026-11-02T08:00:00Z'))).toBe('2026-11-02');
  });
});

describe('isRealIsoDay', () => {
  it('acepta fechas reales, incluido el 29 de febrero de un año bisiesto', () => {
    expect(isRealIsoDay('2026-10-19')).toBe(true);
    expect(isRealIsoDay('2028-02-29')).toBe(true);
  });

  it('rechaza fechas inexistentes o con otro formato', () => {
    for (const bad of ['2026-02-30', '2026-13-01', '2027-02-29', '20261019', '2026-10-9', '', 'hoy']) {
      expect(isRealIsoDay(bad)).toBe(false);
    }
  });
});

describe('countDays', () => {
  it('cuenta ambos extremos y cruza meses, años bisiestos y cambios de horario', () => {
    expect(countDays('2026-10-01', '2026-10-01')).toBe(1);
    expect(countDays('2026-09-28', '2026-10-03')).toBe(6);
    expect(countDays('2028-02-28', '2028-03-01')).toBe(3);
    expect(countDays('2026-10-28', '2026-11-04')).toBe(8);
    expect(countDays('2025-10-22', '2026-10-22')).toBe(366);
  });
});