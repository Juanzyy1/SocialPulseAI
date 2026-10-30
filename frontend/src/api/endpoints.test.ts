import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PeriodSelection } from '../dashboard/period-selection';
import { accountsApi, analyticsApi } from './endpoints';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response('[]', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const lastCall = () => fetchMock.mock.calls.at(-1) as [string, RequestInit];
const preset = (period: '7d' | '30d' | '90d'): PeriodSelection => ({ kind: 'preset', period });
const custom: PeriodSelection = { kind: 'custom', from: '2026-10-01', to: '2026-10-15' };

describe('accountsApi', () => {
  it('list pide GET /social-accounts', async () => {
    await accountsApi.list();

    expect(lastCall()[0]).toBe('/api/v1/social-accounts');
    expect(lastCall()[1].method).toBe('GET');
  });

  it('sync pide POST /social-accounts/:id/sync, sin cuerpo', async () => {
    await accountsApi.sync('cuenta-1');

    const [url, init] = lastCall();
    expect(url).toBe('/api/v1/social-accounts/cuenta-1/sync');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('disconnect pide DELETE /social-accounts/:id', async () => {
    await accountsApi.disconnect('cuenta-1');

    const [url, init] = lastCall();
    expect(url).toBe('/api/v1/social-accounts/cuenta-1');
    expect(init.method).toBe('DELETE');
  });

  it('codifica el identificador para que no pueda alterar la ruta', async () => {
    await accountsApi.sync('a b/../c');
    expect(lastCall()[0]).toBe('/api/v1/social-accounts/a%20b%2F..%2Fc/sync');

    await accountsApi.disconnect('x?y=1');
    expect(lastCall()[0]).toBe('/api/v1/social-accounts/x%3Fy%3D1');
  });
});

describe('analyticsApi', () => {
  it('catalog pide GET /analytics/metrics', async () => {
    await analyticsApi.catalog();

    expect(lastCall()[0]).toBe('/api/v1/analytics/metrics');
  });

  it('compare incluye la cuenta y el periodo, o las fechas, nunca ambos', async () => {
    await analyticsApi.compare('cuenta-1', preset('7d'));
    expect(lastCall()[0]).toBe('/api/v1/analytics/compare?accountId=cuenta-1&period=7d');

    await analyticsApi.compare('cuenta-1', custom);
    expect(lastCall()[0]).toBe(
      '/api/v1/analytics/compare?accountId=cuenta-1&from=2026-10-01&to=2026-10-15',
    );
  });

  it('account pide la serie diaria (daily=true) del periodo o del rango', async () => {
    await analyticsApi.account('cuenta-1', preset('90d'));
    expect(lastCall()[0]).toBe('/api/v1/analytics/accounts/cuenta-1?period=90d&daily=true');

    await analyticsApi.account('cuenta-1', custom);
    expect(lastCall()[0]).toBe(
      '/api/v1/analytics/accounts/cuenta-1?from=2026-10-01&to=2026-10-15&daily=true',
    );
  });

  it('overview pide el resumen global del periodo o del rango, sin cuenta ni serie diaria', async () => {
    await analyticsApi.overview(preset('30d'));
    expect(lastCall()[0]).toBe('/api/v1/analytics/overview?period=30d');

    await analyticsApi.overview(custom);
    expect(lastCall()[0]).toBe('/api/v1/analytics/overview?from=2026-10-01&to=2026-10-15');
  });

  it('codifica el identificador de la cuenta para que no pueda alterar la ruta ni los parámetros', async () => {
    await analyticsApi.account('a b/c', preset('30d'));
    expect(lastCall()[0]).toBe('/api/v1/analytics/accounts/a%20b%2Fc?period=30d&daily=true');

    await analyticsApi.compare('x&period=90d', preset('7d'));
    expect(lastCall()[0]).toBe('/api/v1/analytics/compare?accountId=x%26period%3D90d&period=7d');
  });
});