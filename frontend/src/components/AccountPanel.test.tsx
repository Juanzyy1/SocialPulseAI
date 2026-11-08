// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccountAnalytics, CatalogResponse, ComparisonResponse } from '../api/types';
import { presetSelection } from '../dashboard/period-selection';
import { installFakeApi, jsonResponse } from '../test/fake-api';
import { socialAccount } from '../test/fixtures';
import { renderApp } from '../test/render';
import { AccountPanel } from './AccountPanel';

const period = { kind: '30d', start: '2026-10-09', end: '2026-11-07', days: 30 };

function comparison(platform: 'INSTAGRAM' | 'TIKTOK', hasDailyData: boolean): ComparisonResponse {
  const value = hasDailyData
    ? {
        metric: 'reach',
        kind: 'daily_average',
        unit: 'count' as const,
        note: null,
        current: { value: 12, daysWithData: 1 },
        previous: { value: null, daysWithData: 0 },
        comparable: false,
        reasonCode: 'INSUFFICIENT_DATA',
        reason: 'No hay datos comparables.',
        change: null,
        changePercent: null,
      }
    : null;

  return {
    account: { id: 'cuenta-1', platform, displayName: 'Cuenta de prueba', status: 'ACTIVE' },
    dataThrough: '2026-11-07',
    daysBehind: 0,
    current: { period, coverage: { daysWithData: 1, missingDays: 29, missingRanges: [] } },
    previous: null,
    comparable: false,
    message: null,
    metrics: value ? [value] : [],
  };
}

function analytics(platform: 'INSTAGRAM' | 'TIKTOK'): AccountAnalytics {
  return {
    account: { id: 'cuenta-1', platform, displayName: 'Cuenta de prueba', status: 'ACTIVE' },
    period,
    dataThrough: '2026-11-07',
    daysBehind: 0,
    lastSyncedAt: '2026-11-07T12:00:00.000Z',
    coverage: { daysWithData: 1, missingDays: 29, missingRanges: [] },
    totals: platform === 'TIKTOK'
      ? [
          { metric: 'followers', unit: 'count', value: 1234, capturedOn: '2026-11-07', note: null },
        ]
      : [],
    daily: [
      { date: '2026-11-06', values: { reach: 9 } },
      { date: '2026-11-07', values: { reach: 12 } },
    ],
    message: null,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('gráfico por métrica de plataforma', () => {
  it('grafica el alcance diario de Instagram en vez de buscar una métrica de vistas inexistente', async () => {
    const catalog: CatalogResponse = {
      platforms: [
        {
          platform: 'INSTAGRAM',
          metrics: [
            {
              code: 'reach',
              label: 'Alcance diario promedio',
              kind: 'daily_average',
              unit: 'count',
              polarity: 'higher_is_better',
              note: null,
            },
          ],
        },
      ],
    };
    installFakeApi({
      'GET /analytics/metrics': () => jsonResponse(catalog),
      'GET /analytics/compare?accountId=cuenta-1&period=30d': () =>
        jsonResponse(comparison('INSTAGRAM', true)),
      'GET /analytics/accounts/cuenta-1?period=30d&daily=true': () =>
        jsonResponse(analytics('INSTAGRAM')),
    });

    renderApp(
      <AccountPanel
        account={socialAccount({ platform: 'INSTAGRAM' })}
        selection={presetSelection('30d')}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Alcance diario promedio por día' }),
    ).toBeTruthy();
    expect(screen.getByRole('img', { name: /Alcance diario promedio por día/ })).toBeTruthy();
    expect(screen.getByTestId('metric-sparkline')).toBeTruthy();
  });

  it('adapta TikTok a un resumen de perfil sin periodo ni gráfico diario', async () => {
    const catalog: CatalogResponse = {
      platforms: [
        {
          platform: 'TIKTOK',
          metrics: [
            {
              code: 'followers',
              label: 'Seguidores',
              kind: 'snapshot',
              unit: 'count',
              polarity: 'neutral',
              note: null,
            },
          ],
        },
      ],
    };
    installFakeApi({
      'GET /analytics/metrics': () => jsonResponse(catalog),
      'GET /analytics/compare?accountId=cuenta-1&period=30d': () =>
        jsonResponse(comparison('TIKTOK', false)),
      'GET /analytics/accounts/cuenta-1?period=30d&daily=true': () =>
        jsonResponse(analytics('TIKTOK')),
    });

    renderApp(
      <AccountPanel
        account={socialAccount({ platform: 'TIKTOK' })}
        selection={presetSelection('30d')}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Resumen del perfil' })).toBeTruthy();
    expect(screen.getByLabelText('1.234')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /por día/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Métricas del periodo' })).toBeNull();
  });
});
