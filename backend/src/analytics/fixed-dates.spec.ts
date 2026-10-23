import { pacificDate } from '../common/dates/pacific-date';
import { planSyncRange } from '../sync/sync-range';
import { previousPeriod } from './comparison';
import { countDays, parsePeriodRequest, resolvePeriod, summarizeCoverage } from './period';

/**
 * Casos con fechas FIJAS del calendario (ninguna depende de "hoy"), incluidos los cambios
 * de horario de EE. UU. de 2026 (8 de marzo y 1 de noviembre), un 29 de febrero y el cambio de año.
 */
type PresetKind = '7d' | '30d' | '90d';
const DAYS: Record<PresetKind, number> = { '7d': 7, '30d': 30, '90d': 90 };

const PRESET_CASES: Array<[string, PresetKind, string, string]> = [
  ['30 días hasta el 19/10/2026 (el caso real)', '30d', '2026-10-19', '2026-09-20'],
  ['30 días que cruzan el fin del horario de verano', '30d', '2026-11-05', '2026-10-07'],
  ['7 días que cruzan el inicio del horario de verano', '7d', '2026-03-10', '2026-03-04'],
  ['90 días que cruzan el cambio de año', '90d', '2026-01-15', '2025-10-18'],
  ['30 días que incluyen el 29 de febrero de 2028', '30d', '2028-03-10', '2028-02-10'],
  ['7 días a comienzos de marzo (año no bisiesto)', '7d', '2026-03-01', '2026-02-23'],
];

describe('periodos predefinidos con fechas fijas', () => {
  it.each(PRESET_CASES)('%s', (_name, kind, dataThrough, expectedStart) => {
    expect(resolvePeriod({ kind }, dataThrough)).toEqual({
      kind,
      start: expectedStart,
      end: dataThrough,
      days: DAYS[kind],
    });
    // La longitud real, contando ambos extremos, es la pedida.
    expect(countDays(expectedStart, dataThrough)).toBe(DAYS[kind]);
  });
});

describe('rangos personalizados con fechas fijas', () => {
  const COUNT_CASES: Array<[string, string, number]> = [
    ['2026-10-28', '2026-11-04', 8], // cruza el fin del horario de verano
    ['2026-03-06', '2026-03-10', 5], // cruza el inicio del horario de verano
    ['2028-02-28', '2028-03-01', 3], // incluye el 29 de febrero
    ['2026-02-28', '2026-03-01', 2], // sin 29 de febrero
    ['2025-12-31', '2026-01-01', 2], // cambio de año
  ];

  it.each(COUNT_CASES)('de %s a %s hay %i días', (from, to, expected) => {
    expect(countDays(from, to)).toBe(expected);
  });

  it('el límite de 366 días se aplica con fechas fijas', () => {
    const today = '2026-10-22';
    expect(countDays('2025-10-22', today)).toBe(366);
    expect(parsePeriodRequest({ from: '2025-10-22', to: today }, today).ok).toBe(true);
    expect(parsePeriodRequest({ from: '2025-10-21', to: today }, today).ok).toBe(false);
  });
});

describe('periodo anterior con fechas fijas', () => {
  const PREVIOUS_CASES: Array<[string, string, number, string, string]> = [
    ['2026-11-01', '2026-11-07', 7, '2026-10-25', '2026-10-31'],
    ['2026-03-08', '2026-03-14', 7, '2026-03-01', '2026-03-07'],
    ['2028-03-01', '2028-03-07', 7, '2028-02-23', '2028-02-29'],
    ['2026-09-20', '2026-10-19', 30, '2026-08-21', '2026-09-19'],
  ];

  it.each(PREVIOUS_CASES)(
    'el periodo %s a %s tiene como anterior %s a %s',
    (start, end, days, expectedStart, expectedEnd) => {
      expect(previousPeriod({ kind: 'custom', start, end, days })).toEqual({
        kind: 'previous',
        start: expectedStart,
        end: expectedEnd,
        days,
      });
    },
  );
});

describe('cobertura con fechas fijas', () => {
  it('un hueco que cruza el fin del horario de verano es un solo tramo', () => {
    expect(
      summarizeCoverage('2026-10-30', '2026-11-03', new Set(['2026-10-30', '2026-11-03'])),
    ).toEqual({
      daysWithData: 2,
      missingDays: 3,
      missingRanges: [{ from: '2026-10-31', to: '2026-11-02' }],
    });
  });
});

describe('día del Pacífico en los cambios de horario de 2026', () => {
  it('el 8 de marzo (empieza el horario de verano) dura 23 horas: el límite pasa de 08:00 a 07:00 UTC', () => {
    expect(pacificDate(new Date('2026-03-08T07:59:59Z'))).toBe('2026-03-07');
    expect(pacificDate(new Date('2026-03-08T08:00:00Z'))).toBe('2026-03-08');
    expect(pacificDate(new Date('2026-03-09T06:59:59Z'))).toBe('2026-03-08');
    expect(pacificDate(new Date('2026-03-09T07:00:00Z'))).toBe('2026-03-09');
  });

  it('el 1 de noviembre (termina el horario de verano) dura 25 horas: de 07:00 UTC del 1 a 08:00 UTC del 2', () => {
    expect(pacificDate(new Date('2026-11-01T06:59:59Z'))).toBe('2026-10-31');
    expect(pacificDate(new Date('2026-11-01T07:00:00Z'))).toBe('2026-11-01');
    expect(pacificDate(new Date('2026-11-02T07:59:59Z'))).toBe('2026-11-01');
    expect(pacificDate(new Date('2026-11-02T08:00:00Z'))).toBe('2026-11-02');
  });
});

describe('rango de sincronización con fechas fijas', () => {
  it('la carga inicial son 90 días, también al cruzar el cambio de horario de noviembre', () => {
    expect(planSyncRange('2026-11-05', null)).toEqual({
      start: '2026-08-08',
      end: '2026-11-05',
      kind: 'initial',
    });
  });

  it('la sincronización incremental parte de la fecha más antigua entre el último dato y 7 días atrás', () => {
    expect(planSyncRange('2026-11-05', '2026-11-02')).toEqual({
      start: '2026-10-27',
      end: '2026-11-05',
      kind: 'incremental',
    });
  });
});