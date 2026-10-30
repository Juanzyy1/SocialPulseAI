import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { SESSION_KEY } from '../session/session-core';
import { handleQueryError, shouldRetry } from './query-policy';

describe('shouldRetry', () => {
  it('reintenta una sola vez los fallos de red, del servidor y los desconocidos', () => {
    expect(shouldRetry(0, new ApiError(0, 'red'))).toBe(true);
    expect(shouldRetry(0, new ApiError(500, 'servidor'))).toBe(true);
    expect(shouldRetry(0, new Error('desconocido'))).toBe(true);
    expect(shouldRetry(1, new ApiError(500, 'servidor'))).toBe(false);
  });

  it.each([400, 401, 403, 404, 429])('no reintenta un %i', (status) => {
    expect(shouldRetry(0, new ApiError(status, 'x'))).toBe(false);
  });
});

describe('handleQueryError', () => {
  const seededClient = () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(SESSION_KEY, { id: 'usuario-1' });
    queryClient.setQueryData(['accounts'], [{ id: 'cuenta-1' }]);
    return queryClient;
  };

  it('un 401 en una consulta de datos limpia la sesión y los demás datos', () => {
    const queryClient = seededClient();

    handleQueryError(queryClient, new ApiError(401, 'x'), ['analytics', 'compare']);

    expect(queryClient.getQueryData(SESSION_KEY)).toBeNull();
    expect(queryClient.getQueryData(['accounts'])).toBeUndefined();
  });

  it('un 401 de la propia consulta de sesión se ignora', () => {
    const queryClient = seededClient();

    handleQueryError(queryClient, new ApiError(401, 'x'), SESSION_KEY);

    expect(queryClient.getQueryData(SESSION_KEY)).toEqual({ id: 'usuario-1' });
  });

  it('otros errores no tocan la sesión', () => {
    const queryClient = seededClient();

    handleQueryError(queryClient, new ApiError(500, 'x'), ['accounts']);
    handleQueryError(queryClient, new ApiError(403, 'x'), ['accounts']);
    handleQueryError(queryClient, new Error('no es de la API'), ['accounts']);

    expect(queryClient.getQueryData(SESSION_KEY)).toEqual({ id: 'usuario-1' });
    expect(queryClient.getQueryData(['accounts'])).toEqual([{ id: 'cuenta-1' }]);
  });
});