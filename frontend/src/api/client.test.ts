import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './client';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Devuelve el error de una promesa que debe fallar. */
const failure = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => {
      throw new Error('La llamada debía fallar');
    },
    (error: unknown) => error,
  );

describe('apiFetch', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('una petición GET devuelve el JSON, usa el mismo origen y no envía cuerpo ni Content-Type', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: '1' }));

    const result = await apiFetch<{ id: string }>('/users/me');

    expect(result).toEqual({ id: '1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/users/me');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('same-origin');
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  });

  it('una petición POST envía el cuerpo como JSON con su Content-Type', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: '1' }, 201));
    const body = { email: 'ana@example.com', password: 'una-clave-larga-1234' };

    await apiFetch('/auth/login', { method: 'POST', body });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify(body));
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('un 204 devuelve undefined sin intentar leer el cuerpo', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiFetch('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('un error de Nest con un mensaje produce un ApiError con ese mensaje y su estado', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ statusCode: 401, message: 'Credenciales inválidas', error: 'Unauthorized' }, 401),
    );

    const error = await failure(apiFetch('/auth/login', { method: 'POST', body: {} }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      name: 'ApiError',
      status: 401,
      message: 'Credenciales inválidas',
      details: ['Credenciales inválidas'],
    });
  });

  it('un error de validación con varios mensajes usa el primero y conserva todos', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ statusCode: 400, message: ['email inválido', 'contraseña muy corta'] }, 400),
    );

    const error = await failure(apiFetch('/auth/register', { method: 'POST', body: {} }));

    expect(error).toMatchObject({
      status: 400,
      message: 'email inválido',
      details: ['email inválido', 'contraseña muy corta'],
    });
  });

  it.each([
    [400, 'La solicitud no es válida'],
    [401, 'Necesitas iniciar sesión'],
    [403, 'No tienes permiso para hacer esto'],
    [404, 'No se encontró lo que buscas'],
    [429, 'Demasiados intentos; espera un momento'],
    [500, 'Error del servidor'],
    [502, 'El servidor no está disponible'],
    [418, 'Error inesperado'],
  ])('un %i sin cuerpo JSON usa el mensaje genérico en español', async (status, text) => {
    fetchMock.mockResolvedValue(new Response('<html>error</html>', { status }));

    const error = await failure(apiFetch('/users/me'));

    expect(error).toMatchObject({ status, message: text, details: [] });
  });

  it('ignora los mensajes que no son texto y usa el genérico si no queda ninguno', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 42 }, 400));
    expect(await failure(apiFetch('/x'))).toMatchObject({
      message: 'La solicitud no es válida',
      details: [],
    });

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: ['válido', 5, null] }, 400));
    expect(await failure(apiFetch('/x'))).toMatchObject({ message: 'válido', details: ['válido'] });
  });

  it('un fallo de red produce un ApiError con estado 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await failure(apiFetch('/users/me'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, message: 'No se pudo contactar con el servidor' });
  });

  it('una cancelación se propaga tal cual y no se convierte en ApiError', async () => {
    const abort = new DOMException('cancelado', 'AbortError');
    fetchMock.mockRejectedValue(abort);

    const error = await failure(apiFetch('/users/me'));

    expect(error).toBe(abort);
    expect(error).not.toBeInstanceOf(ApiError);
  });
});