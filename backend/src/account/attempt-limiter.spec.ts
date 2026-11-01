import { AttemptLimiter } from './attempt-limiter';

const MINUTE = 60_000;

function setup(max = 3, windowMs = 15 * MINUTE) {
  let now = 1_000_000;
  const limiter = new AttemptLimiter(max, windowMs, () => now);
  return {
    limiter,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('AttemptLimiter', () => {
  it('sin fallos no bloquea', () => {
    expect(setup().limiter.isBlocked('a')).toBe(false);
  });

  it('bloquea al llegar al máximo de fallos, no antes', () => {
    const { limiter } = setup(3);

    limiter.recordFailure('a');
    limiter.recordFailure('a');
    expect(limiter.isBlocked('a')).toBe(false);

    limiter.recordFailure('a');
    expect(limiter.isBlocked('a')).toBe(true);
  });

  it('cada clave lleva su propia cuenta', () => {
    const { limiter } = setup(2);

    limiter.recordFailure('a');
    limiter.recordFailure('a');

    expect(limiter.isBlocked('a')).toBe(true);
    expect(limiter.isBlocked('b')).toBe(false);
  });

  it('al vencer la ventana se desbloquea', () => {
    const { limiter, advance } = setup(2, 15 * MINUTE);
    limiter.recordFailure('a');
    limiter.recordFailure('a');

    advance(14 * MINUTE);
    expect(limiter.isBlocked('a')).toBe(true);

    advance(MINUTE);
    expect(limiter.isBlocked('a')).toBe(false);
  });

  it('un fallo tras vencer la ventana abre una ventana nueva y no suma a la anterior', () => {
    const { limiter, advance } = setup(2, 15 * MINUTE);
    limiter.recordFailure('a');
    advance(16 * MINUTE);

    limiter.recordFailure('a');

    expect(limiter.isBlocked('a')).toBe(false);
    limiter.recordFailure('a');
    expect(limiter.isBlocked('a')).toBe(true);
  });

  it('reset desbloquea y borra la cuenta', () => {
    const { limiter } = setup(1);
    limiter.recordFailure('a');
    expect(limiter.isBlocked('a')).toBe(true);

    limiter.reset('a');

    expect(limiter.isBlocked('a')).toBe(false);
    expect(limiter.size).toBe(0);
  });

  it('con muchas claves vencidas, la memoria no crece sin límite', () => {
    const { limiter, advance } = setup(3, 15 * MINUTE);
    for (let i = 0; i < 1000; i++) limiter.recordFailure(`usuario-${i}`);
    expect(limiter.size).toBe(1000);

    advance(16 * MINUTE);
    limiter.recordFailure('nuevo');

    expect(limiter.size).toBe(1);
  });
});