import { getMetricDefinition } from './metric-catalog';

export interface DailyValue {
  /** Fecha del Pacífico, AAAA-MM-DD. */
  date: string;
  metric: string;
  value: number;
}

export interface PeriodMetric {
  metric: string;
  /** null si no se puede calcular (por ejemplo, una media sin vistas). */
  value: number | null;
  /** Días con dato que intervinieron en el cálculo. */
  daysWithData: number;
}

/**
 * Agrega los valores diarios de un periodo según el tipo de cada métrica:
 * - additive: suma de los días con dato.
 * - weighted_average: Σ(valor × peso) ÷ Σ(peso), solo en días con valor y peso.
 * - snapshot: no se agrega (se ignora).
 * Solo devuelve métricas que tienen filas: nunca inventa ceros. Las métricas que el
 * catálogo no conoce (o de otra plataforma) se ignoran en lugar de adivinar su tipo.
 * Se espera como máximo una fila por (fecha, métrica), como garantiza la base.
 */
export function aggregatePeriod(
  platform: string,
  daily: readonly DailyValue[],
): PeriodMetric[] {
  const byMetric = new Map<string, DailyValue[]>();
  for (const row of daily) {
    const rows = byMetric.get(row.metric);
    if (rows) rows.push(row);
    else byMetric.set(row.metric, [row]);
  }

  const result: PeriodMetric[] = [];
  for (const [metric, rows] of byMetric) {
    const definition = getMetricDefinition(platform, metric);
    if (!definition) continue;

    if (definition.kind === 'additive') {
      result.push({
        metric,
        value: rows.reduce((sum, row) => sum + row.value, 0),
        daysWithData: rows.length,
      });
    } else if (definition.kind === 'weighted_average') {
      const weights = new Map(
        (byMetric.get(definition.weightedBy ?? '') ?? []).map((r): [string, number] => [
          r.date,
          r.value,
        ]),
      );
      let weightedSum = 0;
      let totalWeight = 0;
      let days = 0;
      for (const row of rows) {
        const weight = weights.get(row.date);
        if (weight === undefined) continue; // sin peso ese día: no se puede ponderar
        weightedSum += row.value * weight;
        totalWeight += weight;
        days += 1;
      }
      result.push({
        metric,
        value: totalWeight > 0 ? weightedSum / totalWeight : null,
        daysWithData: days,
      });
    }
    // snapshot: no se agrega entre días.
  }
  return result;
}