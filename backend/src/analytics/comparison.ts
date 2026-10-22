import { addDays } from '../common/dates/pacific-date';
import type { ResolvedPeriod } from './period';

/** Periodo inmediatamente anterior y de la misma longitud. */
export function previousPeriod(current: ResolvedPeriod): ResolvedPeriod {
  return {
    kind: 'previous',
    start: addDays(current.start, -current.days),
    end: addDays(current.start, -1),
    days: current.days,
  };
}

export interface MetricSummary {
  metric: string;
  kind: string;
  unit: string;
  value: number | null;
  daysWithData: number;
  note: string | null;
}

export type ReasonCode = 'MISSING_DATA' | 'DIFFERENT_COVERAGE';

export interface ComparedSide {
  value: number | null;
  daysWithData: number;
}

export interface MetricComparison {
  metric: string;
  kind: string;
  unit: string;
  note: string | null;
  current: ComparedSide;
  previous: ComparedSide;
  /** false si no se puede comparar con honestidad; el motivo va en `reason`. */
  comparable: boolean;
  reasonCode: ReasonCode | null;
  reason: string | null;
  /** actual − anterior; null si no es comparable. */
  change: number | null;
  /** Cambio relativo en %; null si no es comparable o si el valor anterior es 0. */
  changePercent: number | null;
}

const side = (summary: MetricSummary | undefined): ComparedSide => ({
  value: summary?.value ?? null,
  daysWithData: summary?.daysWithData ?? 0,
});

function findProblem(
  kind: string,
  current: ComparedSide,
  previous: ComparedSide,
): { code: ReasonCode; message: string } | null {
  if (kind === 'weighted_average') {
    return current.value === null || previous.value === null
      ? {
          code: 'MISSING_DATA',
          message: 'La media no se puede calcular en uno de los dos periodos (sin vistas o sin datos)',
        }
      : null;
  }
  if (current.daysWithData === 0 || previous.daysWithData === 0) {
    return { code: 'MISSING_DATA', message: 'Falta dato en uno de los dos periodos' };
  }
  if (current.daysWithData !== previous.daysWithData) {
    return {
      code: 'DIFFERENT_COVERAGE',
      message: `Los periodos tienen distinto número de días con dato (${current.daysWithData} y ${previous.daysWithData})`,
    };
  }
  return null;
}

/**
 * Compara las métricas de dos periodos. Nunca compara en silencio:
 * - sumables: solo si ambos periodos tienen el mismo número de días con dato;
 * - media ponderada: solo si ambos periodos tienen un valor;
 * - un lado sin dato: no comparable.
 * Orden: primero las métricas del periodo actual y luego las que solo estaban en el anterior.
 */
export function compareMetrics(
  current: readonly MetricSummary[],
  previous: readonly MetricSummary[],
): MetricComparison[] {
  const codes: string[] = [];
  for (const item of [...current, ...previous]) {
    if (!codes.includes(item.metric)) codes.push(item.metric);
  }

  return codes.flatMap((code) => {
    const cur = current.find((m) => m.metric === code);
    const prev = previous.find((m) => m.metric === code);
    const reference = cur ?? prev;
    if (!reference) return [];

    const c = side(cur);
    const p = side(prev);
    const problem = findProblem(reference.kind, c, p);
    const change =
      problem === null && c.value !== null && p.value !== null ? c.value - p.value : null;
    const changePercent =
      change !== null && p.value !== null && p.value !== 0
        ? (change / Math.abs(p.value)) * 100
        : null;

    return [
      {
        metric: code,
        kind: reference.kind,
        unit: reference.unit,
        note: reference.note,
        current: c,
        previous: p,
        comparable: change !== null,
        reasonCode: problem?.code ?? null,
        reason: problem?.message ?? null,
        change,
        changePercent,
      },
    ];
  });
}