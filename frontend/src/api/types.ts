/**
 * Tipos escritos a mano a partir de los DTO del backend (no se generan desde Swagger: el
 * generador no soporta TypeScript 6 todavía). Las fechas llegan como texto ISO en el JSON.
 * Revisar contra el backend en la tarea F.7.
 */

/** Respuesta de register y login. */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

/** Respuesta de GET /users/me. */
export interface Profile extends AuthUser {
  avatarUrl: string | null;
  emailVerifiedAt: string | null;
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  /** false: hay que pedir la aceptación de los términos antes de mostrar el panel (F.3c). */
  termsUpToDate: boolean;
  currentTermsVersion: string;
}

export interface RegisterInput {
  email: string;
  /** De 12 a 128 caracteres. */
  password: string;
  /** Hasta 80 caracteres. */
  displayName?: string;
  acceptTerms: true;
  termsVersion: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Cuerpo de POST /users/me/terms (y los campos de aceptación del registro). */
export interface TermsAcceptanceInput {
  acceptTerms: true;
  termsVersion: string;
}

export type MetricUnit = 'count' | 'minutes' | 'seconds';
export type MetricKind = 'additive' | 'weighted_average' | 'snapshot';
export type MetricPolarity = 'higher_is_better' | 'lower_is_better' | 'neutral';
export type AccountStatus = 'ACTIVE' | 'REVOKED' | 'ERROR';

/** Respuesta de GET /social-accounts (nunca incluye credenciales). */
export interface SocialAccount {
  id: string;
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK';
  platformAccountId: string;
  displayName: string | null;
  handle: string | null;
  avatarUrl: string | null;
  status: AccountStatus;
  connectedAt: string;
  lastSyncedAt: string | null;
}

/** Respuesta de GET /analytics/metrics. */
export interface CatalogMetric {
  code: string;
  label: string;
  kind: MetricKind;
  unit: MetricUnit;
  polarity: MetricPolarity;
  note: string | null;
}

export interface CatalogResponse {
  platforms: Array<{ platform: string; metrics: CatalogMetric[] }>;
}

export interface Period {
  kind: string;
  /** AAAA-MM-DD (fecha del Pacífico). */
  start: string;
  end: string;
  days: number;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface Coverage {
  daysWithData: number;
  missingDays: number;
  missingRanges: DateRange[];
}

export interface ComparedValue {
  value: number | null;
  daysWithData: number;
}

export interface MetricComparison {
  metric: string;
  kind: string;
  unit: MetricUnit;
  note: string | null;
  current: ComparedValue;
  previous: ComparedValue;
  comparable: boolean;
  reasonCode: string | null;
  reason: string | null;
  change: number | null;
  changePercent: number | null;
}

export interface PeriodSummary {
  period: Period;
  coverage: Coverage;
}

export interface AnalyticsAccount {
  id: string;
  platform: string;
  displayName: string | null;
  status: AccountStatus;
}

/** Respuesta de GET /analytics/compare. */
export interface ComparisonResponse {
  account: AnalyticsAccount;
  dataThrough: string | null;
  daysBehind: number | null;
  current: PeriodSummary | null;
  previous: PeriodSummary | null;
  comparable: boolean;
  message: string | null;
  metrics: MetricComparison[];
}

export interface TotalValue {
  metric: string;
  unit: MetricUnit;
  value: number;
  /** Fecha del Pacífico en que se capturó. */
  capturedOn: string;
  note: string | null;
}

/** Un día de la serie diaria: solo existen los días que tienen dato. */
export interface DailyPoint {
  date: string;
  values: Record<string, number>;
}

/** Respuesta de GET /analytics/accounts/:id (solo los campos que usa el panel). */
export interface AccountAnalytics {
  account: AnalyticsAccount;
  period: Period | null;
  dataThrough: string | null;
  daysBehind: number | null;
  lastSyncedAt: string | null;
  coverage: Coverage | null;
  totals: TotalValue[];
  /** Solo viene con daily=true; solo incluye los días con dato. */
  daily?: DailyPoint[];
  message: string | null;
}