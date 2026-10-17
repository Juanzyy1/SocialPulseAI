import { Injectable } from '@nestjs/common';
import type { RateRule } from './rate-limit.config';

interface Bucket {
  times: number[];
  windowMs: number;
}

/**
 * Contador de eventos con ventana deslizante, en memoria.
 * Limitaciones: sirve para una sola instancia y se reinicia al reiniciar el servidor.
 * Los métodos aceptan `now` para poder probarlos sin esperar tiempo real.
 */
@Injectable()
export class RateLimiterService {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;
  private static readonly SWEEP_THRESHOLD = 10_000;
  private static readonly SWEEP_EVERY_MS = 60_000;

  /** true si ya se alcanzó el límite dentro de la ventana. */
  isBlocked(key: string, rule: RateRule, now = Date.now()): boolean {
    return this.countRecent(key, rule.windowMs, now) >= rule.limit;
  }

  /** Registra un evento. */
  record(key: string, windowMs: number, now = Date.now()): void {
    this.countRecent(key, windowMs, now); // descarta eventos viejos
    const bucket = this.buckets.get(key) ?? { times: [], windowMs };
    bucket.windowMs = Math.max(bucket.windowMs, windowMs);
    bucket.times.push(now);
    this.buckets.set(key, bucket);

    if (
      this.buckets.size > RateLimiterService.SWEEP_THRESHOLD &&
      now - this.lastSweep > RateLimiterService.SWEEP_EVERY_MS
    ) {
      this.lastSweep = now;
      this.sweep(now);
    }
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  private countRecent(key: string, windowMs: number, now: number): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return 0;
    bucket.times = bucket.times.filter((t) => t > now - windowMs);
    if (bucket.times.length === 0) {
      this.buckets.delete(key);
      return 0;
    }
    return bucket.times.length;
  }

  /** Evita que el mapa crezca sin límite con claves ya caducadas. */
  private sweep(now: number): void {
    for (const [key, bucket] of this.buckets) {
      const last = bucket.times[bucket.times.length - 1];
      if (last === undefined || last <= now - bucket.windowMs) {
        this.buckets.delete(key);
      }
    }
  }
}