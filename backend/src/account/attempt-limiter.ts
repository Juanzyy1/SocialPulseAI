interface Entry {
  count: number;
  resetAt: number;
}

const PRUNE_THRESHOLD = 1000;

/**
 * Cuenta intentos fallidos por clave dentro de una ventana de tiempo, que empieza en el primer fallo.
 * Vive en memoria: vale para una sola instancia y se reinicia al reiniciar la aplicación.
 */
export class AttemptLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Claves guardadas (solo para pruebas). */
  get size(): number {
    return this.entries.size;
  }

  isBlocked(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (entry.resetAt <= this.now()) {
      this.entries.delete(key);
      return false;
    }
    return entry.count >= this.maxFailures;
  }

  recordFailure(key: string): void {
    const now = this.now();
    if (this.entries.size >= PRUNE_THRESHOLD) this.prune(now);
    const entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    entry.count += 1;
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  private prune(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
  }
}