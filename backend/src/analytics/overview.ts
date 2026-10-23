import type { MetricSummary } from './comparison';
import type { MetricDefinition } from './metric-catalog';

export type DefinitionLookup = (platform: string, code: string) => MetricDefinition | undefined;

export interface CombinedMetric {
  metric: string;
  kind: string;
  unit: string;
  value: number | null;
  /** Cuentas cuyo valor intervino en el cálculo. */
  accountsIncluded: number;
  note: string | null;
}

/**
 * Combina las métricas de varias cuentas de UNA misma plataforma:
 * - sumables: suma de los valores de las cuentas;
 * - media ponderada: Σ(media × peso) ÷ Σ(peso), con el peso de cada cuenta (sus propias vistas);
 * - totales puntuales y métricas desconocidas: nunca se combinan.
 */
export function combineSamePlatform(
  platform: string,
  accounts: ReadonlyArray<{ metrics: readonly MetricSummary[] }>,
  definitionOf: DefinitionLookup,
): CombinedMetric[] {
  const codes: string[] = [];
  for (const account of accounts) {
    for (const metric of account.metrics) {
      if (!codes.includes(metric.metric)) codes.push(metric.metric);
    }
  }

  return codes.flatMap((code) => {
    const definition = definitionOf(platform, code);
    if (!definition || definition.kind === 'snapshot') return [];

    let value: number | null = null;
    let included = 0;

    if (definition.kind === 'additive') {
      for (const account of accounts) {
        const found = account.metrics.find((m) => m.metric === code)?.value;
        if (found === undefined || found === null) continue;
        value = (value ?? 0) + found;
        included += 1;
      }
    } else {
      let weighted = 0;
      let totalWeight = 0;
      for (const account of accounts) {
        const average = account.metrics.find((m) => m.metric === code)?.value;
        const weight = account.metrics.find((m) => m.metric === definition.weightedBy)?.value;
        if (average === undefined || average === null || weight === undefined || weight === null) {
          continue;
        }
        weighted += average * weight;
        totalWeight += weight;
        included += 1;
      }
      value = totalWeight > 0 ? weighted / totalWeight : null;
    }

    return [
      {
        metric: code,
        kind: definition.kind,
        unit: definition.unit,
        value,
        accountsIncluded: included,
        note: definition.note ?? null,
      },
    ];
  });
}

export interface CrossPlatformGroup {
  group: string;
  unit: string;
  value: number;
  platforms: string[];
}

/**
 * Suma entre plataformas SOLO las métricas sumables que el catálogo marca con el mismo
 * grupo compatible y que aparecen en dos o más plataformas. Un grupo se descarta si mezcla
 * unidades distintas o si una misma plataforma aporta más de una métrica (duplicaría).
 */
export function sumCompatibleAcrossPlatforms(
  results: ReadonlyArray<{ platform: string; metrics: readonly CombinedMetric[] }>,
  definitionOf: DefinitionLookup,
): CrossPlatformGroup[] {
  interface Draft {
    unit: string;
    value: number;
    platforms: Set<string>;
    valid: boolean;
  }
  const groups = new Map<string, Draft>();

  for (const result of results) {
    for (const metric of result.metrics) {
      const definition = definitionOf(result.platform, metric.metric);
      if (
        !definition ||
        definition.compatibleGroup === null ||
        definition.kind !== 'additive' ||
        metric.value === null
      ) {
        continue;
      }
      const draft = groups.get(definition.compatibleGroup) ?? {
        unit: definition.unit,
        value: 0,
        platforms: new Set<string>(),
        valid: true,
      };
      if (draft.unit !== definition.unit || draft.platforms.has(result.platform)) {
        draft.valid = false;
      }
      draft.value += metric.value;
      draft.platforms.add(result.platform);
      groups.set(definition.compatibleGroup, draft);
    }
  }

  return [...groups.entries()]
    .filter(([, draft]) => draft.valid && draft.platforms.size >= 2)
    .map(([group, draft]) => ({
      group,
      unit: draft.unit,
      value: draft.value,
      platforms: [...draft.platforms],
    }));
}