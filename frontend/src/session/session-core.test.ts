import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionData, fetchSession, SESSION_KEY } from './session-core';

const profile = {
  id: '77c69fe0-cfa1-44f6-a43d-cf33ae48cc89',
  email: 'ana@example.com',
  displayName: 'Ana',
  createdAt: '2026-10-24T00:00:00.000Z',
  avatarUrl: null,
  emailVerifiedAt: null,
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('fetchSession', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devuelve el perfil cuando hay sesión', async () => {
    fetchMock.mockResolvedValue(jsonResponse(profile));

    await expect(fetchSession()).resolves.toEqual(profile);
  });

  it('devuelve null cuando el servidor responde 401 (no hay sesión)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ statusCode: 401, message: 'Unauthorized' }, 401));

    await expect(fetchSession()).resolves.toBeNull();
  });

  it.each([
    ['un 500', () => jsonResponse({ message: 'Error' }, 500)],
    ['un 403', () => jsonResponse({ message: 'Origen no permitido' }, 403)],
    ['un 502 con HTML', () => new Response('<html>Bad Gateway</html>', { status: 502 })],
  ])('%s se relanza: no significa "sin sesión"', async (_name, makeResponse) => {
    fetchMock.mockResolvedValue(makeResponse());

    await expect(fetchSession()).rejects.toMatchObject({ name: 'ApiError' });
  });

  it('un fallo de red se relanza con estado 0: no significa "sin sesión"', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchSession()).rejects.toMatchObject({ name: 'ApiError', status: 0 });
  });
});

describe('clearSessionData', () => {
  it('deja la sesión en null y borra los datos del resto de consultas', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(SESSION_KEY, profile);
    queryClient.setQueryData(['accounts'], [{ id: 'cuenta-1' }]);
    queryClient.setQueryData(['analytics', 'cuenta-1'], { views: 3 });

    clearSessionData(queryClient);

    expect(queryClient.getQueryData(SESSION_KEY)).toBeNull();
    expect(queryClient.getQueryData(['accounts'])).toBeUndefined();
    expect(queryClient.getQueryData(['analytics', 'cuenta-1'])).toBeUndefined();
  });
});