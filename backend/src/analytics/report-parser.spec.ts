import { extractApiError, parseReportTable, summarizeDailyTable } from './report-parser';

const sample = {
  columnHeaders: [{ name: 'day' }, { name: 'views' }],
  rows: [
    ['2026-10-17', 3],
    ['2026-10-16', 0],
    ['2026-10-15', 7],
  ],
};

describe('parseReportTable', () => {
  it('lee las columnas y las filas', () => {
    expect(parseReportTable(sample)).toEqual({
      columns: ['day', 'views'],
      rows: sample.rows,
    });
  });

  it('una respuesta sin `rows` es una tabla vacía', () => {
    expect(parseReportTable({ columnHeaders: [{ name: 'day' }] })).toEqual({
      columns: ['day'],
      rows: [],
    });
  });

  it('devuelve null si el formato no es el esperado', () => {
    for (const bad of [
      null,
      'texto',
      42,
      {},
      { columnHeaders: 'no' },
      { columnHeaders: [{}] },
      { columnHeaders: [{ name: 'day' }], rows: 'no' },
      { columnHeaders: [{ name: 'day' }], rows: [['2026-10-17', 1]] },
      { columnHeaders: [{ name: 'day' }], rows: ['no-es-fila'] },
    ]) {
      expect(parseReportTable(bad)).toBeNull();
    }
  });

  it('convierte a null las celdas que no son texto, número ni booleano', () => {
    const table = parseReportTable({
      columnHeaders: [{ name: 'day' }, { name: 'x' }],
      rows: [['2026-10-17', { raro: true }]],
    });
    expect(table?.rows).toEqual([['2026-10-17', null]]);
  });
});

describe('summarizeDailyTable', () => {
  it('cuenta filas, da el rango de fechas y cuenta los ceros', () => {
    const table = parseReportTable(sample);
    if (!table) throw new Error('tabla inválida');
    expect(summarizeDailyTable(table, 'views')).toEqual({
      rowCount: 3,
      firstDate: '2026-10-15',
      lastDate: '2026-10-17',
      zeroValueRows: 1,
    });
  });

  it('con una tabla vacía o sin la columna pedida no inventa datos', () => {
    expect(summarizeDailyTable({ columns: ['day', 'views'], rows: [] }, 'views')).toEqual({
      rowCount: 0,
      firstDate: null,
      lastDate: null,
      zeroValueRows: 0,
    });
    const table = parseReportTable(sample);
    if (!table) throw new Error('tabla inválida');
    expect(summarizeDailyTable(table, 'likes').zeroValueRows).toBeNull();
  });
});

describe('extractApiError', () => {
  it('devuelve el mensaje, oculta secretos y tiene un valor por defecto', () => {
    expect(extractApiError({ error: { message: 'Unknown metric: dislikes' } })).toBe(
      'Unknown metric: dislikes',
    );
    expect(extractApiError({ error: { message: 'Falló con Bearer abc.def-ghi' } })).not.toContain(
      'abc.def-ghi',
    );
    expect(extractApiError(null)).toBe('sin detalle');
    expect(extractApiError('texto')).toBe('sin detalle');
  });
});