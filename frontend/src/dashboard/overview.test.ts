import { describe, expect, it } from 'vitest';
import type {
  CatalogResponse,
  OverviewAccount,
  OverviewResponse,
  PlatformSummary,
} from '../api/types';
import { accountDashboardLink, buildAccountRows, buildPlatformSections } from './overview';
import { presetSelection } from './period-selection';

const catalog: CatalogResponse = {
  platforms: [
    {
      platform: 'YOUTUBE',
      metrics: [
        { code: 'views', label: 'Vistas', kind: 'additive', unit: 'count', polarity: 'higher_is_better', note: null },
        { code: 'subscriberCount', label: 'Suscriptores', kind: 'snapshot', unit: 'count', polarity: 'neutral', note: null },
      ],
    },
  ],
};

const account = (overrides: Partial<OverviewAccount> = {}): OverviewAccount => ({
  id: 'cuenta-1',
  platform: 'YOUTUBE',
  displayName: 'Canal',
  status: 'ACTIVE',
  lastSyncedAt: '2026-10-22T12:00:00.000Z',
  dataThrough: '2026-10-19',
  daysBehind: 3,
  coverage: { daysWithData: 30, missingDays: 0, missingRanges: [] },
  metrics: [{ metric: 'views', kind: 'additive', unit: 'count', value: 3, daysWithData: 30, note: null }],
  totals: [{ metric: 'subscriberCount', unit: 'count', value: 1234, capturedOn: '2026-10-22', note: null }],
  ...overrides,
});

const platform = (overrides: Partial<PlatformSummary> = {}): PlatformSummary => ({
  platform: 'YOUTUBE',
  accountCount: 1,
  accountsWithData: 1,
  complete: true,
  metrics: [{ metric: 'views', kind: 'additive', unit: 'count', value: 3, accountsIncluded: 1, note: null }],
  ...overrides,
});

const response = (overrides: Partial<OverviewResponse> = {}): OverviewResponse => ({
  period: { kind: '30d', start: '2026-09-20', end: '2026-10-19', days: 30 },
  dataThrough: '2026-10-19',
  daysBehind: 3,
  accounts: [account()],
  platforms: [platform()],
  crossPlatform: { groups: [], message: null },
  message: null,
  ...overrides,
});

describe('buildPlatformSections', () => {
  it('una plataforma completa con una cuenta: título, tarjeta con etiqueta del catálogo y sin aviso', () => {
    expect(buildPlatformSections(response(), catalog)).toEqual([
      {
        platform: 'YOUTUBE',
        title: 'YouTube',
        accountsText: '1 cuenta',
        notice: null,
        cards: [
          {
            code: 'views',
            label: 'Vistas',
            valueText: '3',
            hasValue: true,
            accountsText: 'Cuentas incluidas: 1 de 1',
            note: null,
          },
        ],
      },
    ]);
  });

  it('con una cuenta sin datos, los totales son parciales y se cuenta cuántas tienen datos', () => {
    const [section] = buildPlatformSections(
      response({
        platforms: [platform({ accountCount: 2, accountsWithData: 1, complete: false })],
      }),
      catalog,
    );

    expect(section?.accountsText).toBe('2 cuentas · 1 con datos');
    expect(section?.notice).toContain('Totales parciales');
    expect(section?.cards[0]?.accountsText).toBe('Cuentas incluidas: 1 de 2');
  });

  it('con todas las cuentas con datos pero a alguna le faltan días, el total también es parcial', () => {
    const [section] = buildPlatformSections(
      response({ platforms: [platform({ accountCount: 2, accountsWithData: 2, complete: false })] }),
      catalog,
    );

    expect(section?.accountsText).toBe('2 cuentas');
    expect(section?.notice).toContain('Totales parciales');
  });

  it('si ninguna cuenta tiene datos lo dice y no hay tarjetas', () => {
    const [section] = buildPlatformSections(
      response({ platforms: [platform({ accountsWithData: 0, complete: false, metrics: [] })] }),
      catalog,
    );

    expect(section?.notice).toBe('Ninguna cuenta de esta plataforma tiene datos en este periodo.');
    expect(section?.cards).toEqual([]);
  });

  it('una métrica sin valor muestra "Sin dato", nunca un cero', () => {
    const [section] = buildPlatformSections(
      response({
        platforms: [
          platform({
            metrics: [
              { metric: 'views', kind: 'additive', unit: 'count', value: null, accountsIncluded: 0, note: null },
            ],
          }),
        ],
      }),
      catalog,
    );

    expect(section?.cards[0]).toMatchObject({
      valueText: 'Sin dato',
      hasValue: false,
      accountsText: 'Ninguna cuenta aporta dato',
    });
  });

  it('una métrica que el catálogo no conoce se muestra con su código y conserva su advertencia', () => {
    const [section] = buildPlatformSections(
      response({
        platforms: [
          platform({
            metrics: [
              { metric: 'inventada', kind: 'additive', unit: 'minutes', value: 125, accountsIncluded: 1, note: 'ojo' },
            ],
          }),
        ],
      }),
      catalog,
    );

    expect(section?.cards[0]).toMatchObject({ label: 'inventada', valueText: '2 h 5 min', note: 'ojo' });
  });

  it('sin plataformas no hay secciones', () => {
    expect(buildPlatformSections(response({ platforms: [] }), catalog)).toEqual([]);
  });
});

describe('buildAccountRows', () => {
  it('una cuenta completa: nombre, estado, sincronización, cobertura, vistas y totales con etiqueta', () => {
    expect(buildAccountRows(response(), catalog)).toEqual([
      {
        id: 'cuenta-1',
        name: 'Canal',
        platformText: 'YouTube',
        status: 'ACTIVE',
        lastSyncText: 'Sincronizada el 22 oct 2026',
        dataThroughText: 'Datos hasta el 19 oct 2026',
        coverageText: '30 de 30 días con dato',
        coverageWarning: false,
        viewsLabel: 'Vistas',
        viewsText: '3',
        totals: [{ label: 'Suscriptores', valueText: '1.234' }],
      },
    ]);
  });

  it('a una cuenta con días ausentes se le avisa', () => {
    const [row] = buildAccountRows(
      response({
        accounts: [
          account({ coverage: { daysWithData: 27, missingDays: 3, missingRanges: [] } }),
        ],
      }),
      catalog,
    );

    expect(row?.coverageText).toBe('27 de 30 días con dato');
    expect(row?.coverageWarning).toBe(true);
  });

  it('una cuenta sin datos, sin periodo o sin sincronizar lo dice sin inventar nada', () => {
    const [row] = buildAccountRows(
      response({
        accounts: [
          account({
            displayName: '   ',
            dataThrough: null,
            lastSyncedAt: null,
            coverage: null,
            metrics: [],
            totals: [],
            status: 'REVOKED',
          }),
        ],
      }),
      catalog,
    );

    expect(row).toMatchObject({
      name: 'Cuenta sin nombre',
      status: 'REVOKED',
      lastSyncText: 'Aún sin sincronizar',
      dataThroughText: 'Sin datos',
      coverageText: 'Sin datos en este periodo',
      coverageWarning: false,
      viewsText: 'Sin dato',
      totals: [],
    });
  });

  it('cobertura de cero días con dato también es "Sin datos en este periodo"', () => {
    const [row] = buildAccountRows(
      response({
        accounts: [
          account({ coverage: { daysWithData: 0, missingDays: 10, missingRanges: [] }, metrics: [] }),
        ],
      }),
      catalog,
    );

    expect(row?.coverageText).toBe('Sin datos en este periodo');
    expect(row?.coverageWarning).toBe(true);
  });

  it('los totales de dos cuentas se muestran cada uno en la suya y no se suman', () => {
    const rows = buildAccountRows(
      response({
        accounts: [
          account({ id: 'a' }),
          account({
            id: 'b',
            totals: [{ metric: 'subscriberCount', unit: 'count', value: 8, capturedOn: '2026-10-22', note: null }],
          }),
        ],
      }),
      catalog,
    );

    expect(rows.map((row) => row.totals[0]?.valueText)).toEqual(['1.234', '8']);
  });
});

describe('accountDashboardLink', () => {
  it('conserva el periodo predefinido o el rango elegido', () => {
    expect(accountDashboardLink('cuenta-1', presetSelection('7d'))).toBe('/?period=7d&account=cuenta-1');
    expect(
      accountDashboardLink('cuenta-1', { kind: 'custom', from: '2026-10-01', to: '2026-10-15' }),
    ).toBe('/?from=2026-10-01&to=2026-10-15&account=cuenta-1');
  });

  it('codifica el identificador para que no pueda alterar la dirección', () => {
    expect(accountDashboardLink('a&period=90d', presetSelection('7d'))).toBe(
      '/?period=7d&account=a%26period%3D90d',
    );
  });
});