import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('compare incluye la cuenta y el periodo', async () => {
    await analyticsApi.compare('cuenta-1', '7d');

    expect(lastCall()[0]).toBe('/api/v1/analytics/compare?accountId=cuenta-1&period=7d');
  });

  it('account pide la serie diaria (daily=true) del periodo', async () => {
    await analyticsApi.account('cuenta-1', '90d');

    expect(lastCall()[0]).toBe('/api/v1/analytics/accounts/cuenta-1?period=90d&daily=true');
  });

  it('codifica el identificador de la cuenta para que no pueda alterar la ruta ni los parámetros', async () => {
    await analyticsApi.account('a b/c', '30d');
    expect(lastCall()[0]).toBe('/api/v1/analytics/accounts/a%20b%2Fc?period=30d&daily=true');

    await analyticsApi.compare('x&period=90d', '7d');
    expect(lastCall()[0]).toBe('/api/v1/analytics/compare?accountId=x%26period%3D90d&period=7d');
  });
});