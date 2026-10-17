export interface RateRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitConfig {
  loginFailuresPerEmail: RateRule;
  loginFailuresPerIp: RateRule;
  registrationsPerIp: RateRule;
}

const MINUTE_MS = 60_000;

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  loginFailuresPerEmail: { limit: 5, windowMs: 15 * MINUTE_MS },
  loginFailuresPerIp: { limit: 5, windowMs: 15 * MINUTE_MS },
  registrationsPerIp: { limit: 10, windowMs: 60 * MINUTE_MS },
};

/** Token de inyección: permite a las pruebas sustituir los límites. */
export const RATE_LIMIT_CONFIG = Symbol('RATE_LIMIT_CONFIG');