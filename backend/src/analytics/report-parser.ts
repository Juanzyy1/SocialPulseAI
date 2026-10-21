import { redactSecrets } from '../common/logging/redact';

export type Cell = string | number | boolean | null;

export interface ReportTable {
  columns: string[];
  rows: Cell[][];
}

/**
 * Convierte la respuesta de YouTube Analytics en una tabla. Devuelve null si el formato no
 * es el esperado. Si la respuesta no trae `rows`, se interpreta como "sin datos".
 */
export function parseReportTable(body: unknown): ReportTable | null {
  if (typeof body !== 'object' || body === null) return null;
  const { columnHeaders, rows } = body as { columnHeaders?: unknown; rows?: unknown };
  if (!Array.isArray(columnHeaders)) return null;

  const columns: string[] = [];
  for (const header of columnHeaders) {
    const name = (header as { name?: unknown } | null)?.name;
    if (typeof name !== 'string') return null;
    columns.push(name);
  }

  if (rows === undefined) return { columns, rows: [] };
  if (!Array.isArray(rows)) return null;

  const parsed: Cell[][] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== columns.length) return null;
    parsed.push(
      row.map((cell) =>
        typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean'
          ? cell
          : null,
      ),
    );
  }
  return { columns, rows: parsed };
}

export interface DailySummary {
  rowCount: number;
  firstDate: string | null;
  lastDate: string | null;
  /** Filas cuyo valor es exactamente 0; null si la columna no existe. */
  zeroValueRows: number | null;
}

/** Resume una tabla diaria: cuántas filas trae, su rango de fechas y cuántas valen cero. */
export function summarizeDailyTable(table: ReportTable, valueColumn: string): DailySummary {
  const dayIndex = table.columns.indexOf('day');
  const valueIndex = table.columns.indexOf(valueColumn);
  const days =
    dayIndex === -1
      ? []
      : table.rows
          .map((row) => row[dayIndex])
          .filter((day): day is string => typeof day === 'string')
          .sort();

  return {
    rowCount: table.rows.length,
    firstDate: days[0] ?? null,
    lastDate: days[days.length - 1] ?? null,
    zeroValueRows:
      valueIndex === -1 ? null : table.rows.filter((row) => row[valueIndex] === 0).length,
  };
}

/** Mensaje de error de la API, sin secretos y de longitud acotada. */
export function extractApiError(body: unknown): string {
  const message = (body as { error?: { message?: unknown } } | null)?.error?.message;
  return redactSecrets(typeof message === 'string' ? message : 'sin detalle');
}