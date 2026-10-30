import { describe, expect, it } from 'vitest';
import type { Coverage } from '../api/types';
import { describeFreshness } from './freshness';
import type { FreshnessInput } from './freshness';

const complete: Coverage = { daysWithData: 30, missingDays: 0, missingRanges: [] };
const NOW = new Date('2026-10-22T14:00:00.000Z');

/** Cuenta sincronizada hace unas horas, con datos hasta el 19. */
const base: FreshnessInput = {
  dataThrough: '2026-10-19',
  daysBehind: 3,
  coverage: complete,
  lastSyncedAt: '2026-10-22T10:00:00.000Z',
  now: NOW,
};

describe('describeFreshness: retraso y sincronización', () => {
  it('sin datos lo dice y no muestra retraso, sincronización ni huecos', () => {
    expect(
      describeFreshness({ ...base, dataThrough: null, daysBehind: null, coverage: null }),
    ).toEqual({
      headline: 'Todavía no hay datos de esta cuenta',
      lag: null,
      sync: null,
      gaps: null,
    });
  });

  it('con datos al día muestra la fecha y nada más', () => {
    expect(describeFreshness({ ...base, daysBehind: 0 })).toEqual({
      headline: 'Datos hasta el 19 oct 2026',
      lag: null,
      sync: null,
      gaps: null,
    });
  });

  it('con una sincronización reciente, el retraso se atribuye a la plataforma, con la gramática correcta', () => {
    expect(describeFreshness({ ...base, daysBehind: 1 }).lag).toBe(
      'Los datos más recientes tardan en estar disponibles: falta 1 día hasta hoy.',
    );
    expect(describeFreshness({ ...base, daysBehind: 3 }).lag).toBe(
      'Los datos más recientes tardan en estar disponibles: faltan 3 días hasta hoy.',
    );
    expect(describeFreshness({ ...base, daysBehind: 3 }).sync).toBeNull();
  });

  it('con una sincronización antigua avisa de que hay que sincronizar y NO culpa a la plataforma', () => {
    const info = describeFreshness({
      ...base,
      daysBehind: 10,
      lastSyncedAt: '2026-10-15T12:00:00.000Z',
      now: new Date('2026-10-22T12:00:00.000Z'),
    });

    expect(info.sync).toBe(
      'Última sincronización: 15 oct 2026 (hace 7 días). Sincroniza la cuenta para traer los datos más recientes.',
    );
    expect(info.lag).toBeNull();
  });

  it('una sincronización de hace un día usa el singular', () => {
    const info = describeFreshness({
      ...base,
      lastSyncedAt: '2026-10-21T12:00:00.000Z',
      now: new Date('2026-10-22T12:00:00.000Z'),
    });

    expect(info.sync).toContain('(hace 1 día)');
  });

  it('una sincronización de hace menos de un día no avisa de nada', () => {
    const info = describeFreshness({
      ...base,
      daysBehind: 0,
      lastSyncedAt: '2026-10-21T13:00:00.000Z',
      now: new Date('2026-10-22T12:00:00.000Z'),
    });

    expect(info.sync).toBeNull();
    expect(info.lag).toBeNull();
  });

  it('sin fecha de sincronización pero con datos, el retraso se muestra como siempre y no hay aviso de sincronizar', () => {
    const info = describeFreshness({ ...base, lastSyncedAt: null });

    expect(info.sync).toBeNull();
    expect(info.lag).toContain('faltan 3 días');
  });

  it('una fecha de sincronización ilegible no genera aviso', () => {
    expect(describeFreshness({ ...base, lastSyncedAt: 'no-es-fecha' }).sync).toBeNull();
  });
});

describe('describeFreshness: huecos dentro del periodo', () => {
  it('un retraso sin huecos no es una advertencia de huecos', () => {
    expect(describeFreshness(base).gaps).toBeNull();
  });

  it('indica los días que faltan dentro del periodo, con sus tramos', () => {
    const coverage: Coverage = {
      daysWithData: 27,
      missingDays: 3,
      missingRanges: [
        { from: '2026-09-22', to: '2026-09-22' },
        { from: '2026-10-01', to: '2026-10-02' },
      ],
    };

    expect(describeFreshness({ ...base, coverage }).gaps).toBe(
      'Faltan 3 días de datos dentro de este periodo (22 sep 2026; 1 oct 2026 – 2 oct 2026).',
    );
  });

  it('un solo día ausente usa el singular', () => {
    const coverage: Coverage = {
      daysWithData: 6,
      missingDays: 1,
      missingRanges: [{ from: '2026-10-15', to: '2026-10-15' }],
    };

    expect(describeFreshness({ ...base, coverage }).gaps).toBe(
      'Faltan 1 día de datos dentro de este periodo (15 oct 2026).',
    );
  });

  it('con más de tres tramos lista tres y avisa de que hay más', () => {
    const coverage: Coverage = {
      daysWithData: 4,
      missingDays: 4,
      missingRanges: ['01', '03', '05', '07'].map((day) => ({
        from: `2026-10-${day}`,
        to: `2026-10-${day}`,
      })),
    };

    expect(describeFreshness({ ...base, coverage }).gaps).toBe(
      'Faltan 4 días de datos dentro de este periodo (1 oct 2026; 3 oct 2026; 5 oct 2026 y otros tramos).',
    );
  });
});