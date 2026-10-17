import { RateLimiterService } from './rate-limiter.service';

const RULE = { limit: 3, windowMs: 1000 };

describe('RateLimiterService', () => {
  it('no bloquea por debajo del límite y sí al alcanzarlo', () => {
    const limiter = new RateLimiterService();
    limiter.record('k', 1000, 1000);
    limiter.record('k', 1000, 1001);
    expect(limiter.isBlocked('k', RULE, 1002)).toBe(false);
    limiter.record('k', 1000, 1002);
    expect(limiter.isBlocked('k', RULE, 1003)).toBe(true);
  });

  it('libera la clave cuando los eventos salen de la ventana', () => {
    const limiter = new RateLimiterService();
    for (const t of [1000, 1001, 1002]) limiter.record('k', 1000, t);
    expect(limiter.isBlocked('k', RULE, 1500)).toBe(true);
    expect(limiter.isBlocked('k', RULE, 2500)).toBe(false);
  });

  it('reset borra el contador de una clave', () => {
    const limiter = new RateLimiterService();
    for (const t of [1000, 1001, 1002]) limiter.record('k', 1000, t);
    limiter.reset('k');
    expect(limiter.isBlocked('k', RULE, 1003)).toBe(false);
  });

  it('las claves son independientes', () => {
    const limiter = new RateLimiterService();
    for (const t of [1000, 1001, 1002]) limiter.record('a', 1000, t);
    expect(limiter.isBlocked('a', RULE, 1003)).toBe(true);
    expect(limiter.isBlocked('b', RULE, 1003)).toBe(false);
  });
});