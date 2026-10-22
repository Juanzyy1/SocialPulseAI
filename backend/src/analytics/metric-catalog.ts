/**
 * Catálogo de métricas: qué significa cada código y cómo se puede agregar.
 * Es la defensa contra sumar métricas incompatibles: el resto del código decide
 * por el `kind` de aquí, nunca por el nombre de la métrica.
 */
export type MetricKind =
  /** Se suma sobre los días con dato. */
  | 'additive'
  /** No se suma: se promedia ponderando por otra métrica diaria. */
  | 'weighted_average'
  /** Total puntual en una fecha. No se agrega entre días. */
  | 'snapshot';

export type MetricUnit = 'count' | 'minutes' | 'seconds';

export interface MetricDefinition {
  code: string;
  kind: MetricKind;
  unit: MetricUnit;
  /** Solo para `weighted_average`: métrica diaria cuyos valores sirven de peso. */
  weightedBy?: string;
  /**
   * Solo las métricas con el mismo grupo pueden sumarse entre plataformas.
   * null = no se suma entre plataformas (todas, por ahora: "vistas" de YouTube no
   * equivale a la de otra red hasta que se verifique).
   */
  compatibleGroup: string | null;
  /** Advertencia que debe acompañar al dato cuando se muestre. */
  note?: string;
}

const YOUTUBE: readonly MetricDefinition[] = [
  { code: 'views', kind: 'additive', unit: 'count', compatibleGroup: null },
  {
    code: 'estimatedMinutesWatched',
    kind: 'additive',
    unit: 'minutes',
    compatibleGroup: null,
    note: 'YouTube lo entrega en minutos enteros por día: sumar muchos días con valores pequeños subestima el tiempo real',
  },
  {
    code: 'averageViewDuration',
    kind: 'weighted_average',
    unit: 'seconds',
    weightedBy: 'views',
    compatibleGroup: null,
    note: 'Media ponderada por vistas; no es la suma ni el promedio simple de los días',
  },
  { code: 'likes', kind: 'additive', unit: 'count', compatibleGroup: null },
  { code: 'comments', kind: 'additive', unit: 'count', compatibleGroup: null },
  { code: 'shares', kind: 'additive', unit: 'count', compatibleGroup: null },
  {
    code: 'subscribersGained',
    kind: 'additive',
    unit: 'count',
    compatibleGroup: null,
    note: 'Eventos de suscripción en el periodo; no es el total de suscriptores',
  },
  {
    code: 'subscribersLost',
    kind: 'additive',
    unit: 'count',
    compatibleGroup: null,
    note: 'Bajas en el periodo; no es el total de suscriptores',
  },
  {
    code: 'subscriberCount',
    kind: 'snapshot',
    unit: 'count',
    compatibleGroup: null,
    note: 'Total en la fecha de captura. YouTube puede redondearlo (sin verificar con un canal grande)',
  },
  { code: 'viewCount', kind: 'snapshot', unit: 'count', compatibleGroup: null },
  { code: 'videoCount', kind: 'snapshot', unit: 'count', compatibleGroup: null },
];

const CATALOG: Record<string, readonly MetricDefinition[]> = { YOUTUBE };

export function metricsOf(platform: string): readonly MetricDefinition[] {
  return CATALOG[platform] ?? [];
}

export function getMetricDefinition(
  platform: string,
  code: string,
): MetricDefinition | undefined {
  return metricsOf(platform).find((m) => m.code === code);
}

/** Métricas que se piden a la API por día (sumables y medias ponderadas). */
export function dailyMetricCodes(platform: string): string[] {
  return metricsOf(platform)
    .filter((m) => m.kind !== 'snapshot')
    .map((m) => m.code);
}

/** Totales puntuales que se capturan al sincronizar. */
export function snapshotMetricCodes(platform: string): string[] {
  return metricsOf(platform)
    .filter((m) => m.kind === 'snapshot')
    .map((m) => m.code);
}

/** Si una métrica puede sumarse con la de otra plataforma en un resumen global. */
export function isCompatibleForGlobalSum(definition: MetricDefinition): boolean {
  return definition.compatibleGroup !== null;
}