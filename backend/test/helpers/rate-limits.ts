import type { RateLimitConfig } from '../../src/auth/rate-limit.config';

/** Límites que en la práctica nunca se alcanzan: para pruebas que hacen muchas peticiones. */
export const PERMISSIVE_RATE_LIMITS: RateLimitConfig = {
  loginFailuresPerEmail: { limit: 1_000_000, windowMs: 900_000 },
  loginFailuresPerIp: { limit: 1_000_000, windowMs: 900_000 },
  registrationsPerIp: { limit: 1_000_000, windowMs: 3_600_000 },
};