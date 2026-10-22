import { snapshotMetricCodes } from '../analytics/metric-catalog';
import { ReportTable } from '../analytics/report-parser';
import { statsToSnapshots, SyncDataError, tableToMetricRows } from './youtube-sync.mapper';

const RANGE = { start: '2026-10-15', end: '2026-10-21' };
const ALLOWED = ['views', 'likes'];

const table = (columns: string[], rows: ReportTable['rows']): ReportTable => ({ columns, rows });

describe('tableToMetricRows', () => {
  it('convierte las filas e ignora las columnas que no están permitidas', () => {
    const result = tableToMetricRows(
      table(['day', 'views', 'engagedViews', 'likes'], [['2026-10-18', 3, 1, 0]]),
      ALLOWED,
      RANGE,
    );
    expect(result).toEqual([
      { date: '2026-10-18', metric: 'views', value: 3 },
      { date: '2026-10-18', metric: 'likes', value: 0 },
    ]);
  });

  it('una tabla vacía no produce filas', () => {
    expect(tableToMetricRows(table(['day', 'views'], []), ALLOWED, RANGE)).toEqual([]);
  });

  it('falla si falta la columna day', () => {
    expect(() => tableToMetricRows(table(['views'], [[1]]), ALLOWED, RANGE)).toThrow(SyncDataError);
  });

  it('falla con fechas mal formadas, inexistentes o fuera del rango', () => {
    for (const bad of ['no-es-fecha', '2026-02-30', '2026-10-14', '2026-10-22']) {
      expect(() =>
        tableToMetricRows(table(['day', 'views'], [[bad, 1]]), ALLOWED, RANGE),
      ).toThrow(SyncDataError);
    }
  });

  it('falla si un valor no es un número finito', () => {
    for (const bad of ['3', null, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        tableToMetricRows(table(['day', 'views'], [['2026-10-18', bad]]), ALLOWED, RANGE),
      ).toThrow(SyncDataError);
    }
  });

  it('con duplicados (fecha, métrica) gana el último', () => {
    const result = tableToMetricRows(
      table(['day', 'views'], [['2026-10-18', 1], ['2026-10-18', 7]]),
      ALLOWED,
      RANGE,
    );
    expect(result).toEqual([{ date: '2026-10-18', metric: 'views', value: 7 }]);
  });
});

describe('statsToSnapshots', () => {
  it('convierte los totales de texto a número, con los códigos del catálogo', () => {
    const rows = statsToSnapshots({
      viewCount: '3',
      subscriberCount: '5',
      videoCount: '1',
      hiddenSubscriberCount: false,
    });
    expect(rows).toEqual([
      { metric: 'viewCount', value: 3 },
      { metric: 'subscriberCount', value: 5 },
      { metric: 'videoCount', value: 1 },
    ]);
    expect(rows.every((row) => snapshotMetricCodes('YOUTUBE').includes(row.metric))).toBe(true);
  });

  it('no guarda el total de suscriptores si están ocultos', () => {
    const rows = statsToSnapshots({
      viewCount: '3',
      subscriberCount: '5',
      videoCount: '1',
      hiddenSubscriberCount: true,
    });
    expect(rows.map((row) => row.metric)).toEqual(['viewCount', 'videoCount']);
  });

  it('descarta los valores ausentes o que no son enteros', () => {
    const rows = statsToSnapshots({
      viewCount: null,
      subscriberCount: '12.5',
      videoCount: 'muchos',
      hiddenSubscriberCount: null,
    });
    expect(rows).toEqual([]);
  });
});