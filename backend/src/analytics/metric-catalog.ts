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

/**
 * Qué dirección de cambio es buena para quien consulta. Sirve para colorear variaciones en la
 * interfaz (que bajen las bajas es bueno); no es un juicio sobre la calidad del canal.
 */
export type MetricPolarity = 'higher_is_better' | 'lower_is_better' | 'neutral';

export interface MetricDefinition {
  code: string;
  /** Nombre para mostrar, en español. */
  label: string;
  kind: MetricKind;
  unit: MetricUnit;
  polarity: MetricPolarity;
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
  {
    code: 'views',
    label: 'Vistas',
    kind: 'additive',
    unit: 'count',
    polarity: 'higher_is_better',
    compatibleGroup: null,
  },
  {
    code: 'estimatedMinutesWatched',
    label: 'Minutos vistos',
    kind: 'additive',
    unit: 'minutes',
    polarity: 'higher_is_better',
    compatibleGroup: null,
    note: 'YouTube lo entrega en minutos enteros por día: sumar muchos días con valores pequeños subestima el tiempo real',
  },
  {
    code: 'averageViewDuration',
    label: 'Duración media de reproducción',
    kind: 'weighted_average',
    unit: 'seconds',
    polarity: 'higher_is_better',
    weightedBy: 'views',
    compatibleGroup: null,
    note: 'Media ponderada por vistas; no es la suma ni el promedio simple de los días',
  },
  {
    code: 'likes',
    label: 'Me gusta',
    kind: 'additive',
    unit: 'count',
    polarity: 'higher_is_better',
    compatibleGroup: null,
  },
  {
    code: 'comments',
    label: 'Comentarios',
    kind: 'additive',
    unit: 'count',
    polarity: 'higher_is_better',
    compatibleGroup: null,
  },
  {
    code: 'shares',
    label: 'Veces compartido',
    kind: 'additive',
    unit: 'count',
    polarity: 'higher_is_better',
    compatibleGroup: null,
  },
  {
    code: 'subscribersGained',
    label: 'Suscriptores ganados',
    kind: 'additive',
    unit: 'count',
    polarity: 'higher_is_better',
    compatibleGroup: null,
    note: 'Eventos de suscripción en el periodo; no es el total de suscriptores',
  },
  {
    code: 'subscribersLost',
    label: 'Suscriptores perdidos',
    kind: 'additive',
    unit: 'count',
    polarity: 'lower_is_better',
    compatibleGroup: null,
    note: 'Bajas en el periodo; no es el total de suscriptores',
  },
  {
    code: 'subscriberCount',
    label: 'Suscriptores',
    kind: 'snapshot',
    unit: 'count',
    polarity: 'neutral',
    compatibleGroup: null,
    note: 'Total en la fecha de captura. YouTube puede redondearlo (sin verificar con un canal grande)',
  },
  {
    code: 'viewCount',
    label: 'Vistas totales',
    kind: 'snapshot',
    unit: 'count',
    polarity: 'neutral',
    compatibleGroup: null,
  },
  {
    code: 'videoCount',
    label: 'Videos',
    kind: 'snapshot',
    unit: 'count',
    polarity: 'neutral',
    compatibleGroup: null,
  },
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

/** Métrica tal como la entrega la API del catálogo: sin datos internos de agregación. */
export interface CatalogMetric {
  code: string;
  label: string;
  kind: MetricKind;
  unit: MetricUnit;
  polarity: MetricPolarity;
  note: string | null;
}

export interface PlatformCatalog {
  platform: string;
  metrics: CatalogMetric[];
}

/** Catálogo completo para la interfaz. Devuelve copias: modificarlas no altera el catálogo. */
export function describeCatalog(): PlatformCatalog[] {
  return Object.entries(CATALOG).map(([platform, metrics]) => ({
    platform,
    metrics: metrics.map((metric) => ({
      code: metric.code,
      label: metric.label,
      kind: metric.kind,
      unit: metric.unit,
      polarity: metric.polarity,
      note: metric.note ?? null,
    })),
  }));
}