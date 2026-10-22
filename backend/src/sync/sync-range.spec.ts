import { planSyncRange } from './sync-range';

const TODAY = '2026-10-21';

describe('planSyncRange', () => {
  it('sin datos previos pide los últimos 90 días', () => {
    expect(planSyncRange(TODAY, null)).toEqual({
      start: '2026-07-24',
      end: TODAY,
      kind: 'initial',
    });
  });

  it('con datos recientes relee desde 7 días antes del último dato', () => {
    expect(planSyncRange(TODAY, '2026-10-19')).toEqual({
      start: '2026-10-13',
      end: TODAY,
      kind: 'incremental',
    });
  });

  it('si el último dato es de hoy, relee los últimos 7 días', () => {
    expect(planSyncRange(TODAY, TODAY).start).toBe('2026-10-15');
  });

  it('un hueco largo se limita a 90 días', () => {
    expect(planSyncRange(TODAY, '2026-01-01').start).toBe('2026-07-24');
  });

  it('un último dato en el futuro no adelanta el inicio', () => {
    expect(planSyncRange(TODAY, '2026-11-01').start).toBe('2026-10-15');
  });
});