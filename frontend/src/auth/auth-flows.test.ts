import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { buildRegisterInput, registerThenLogin } from './auth-flows';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('buildRegisterInput', () => {
  const form = {
    displayName: '  Ana  ',
    email: '  ana@example.com ',
    password: ' una clave con espacios ',
    acceptTerms: true,
  };

  it('recorta el nombre y el correo, no la contraseña, y añade la versión de los términos', () => {
    expect(buildRegisterInput(form)).toEqual({
      email: 'ana@example.com',
      password: ' una clave con espacios ',
      displayName: 'Ana',
      acceptTerms: true,
      termsVersion: '2026-10-24',
    });
  });

  it('omite el nombre si queda vacío', () => {
    expect(buildRegisterInput({ ...form, displayName: '   ' })).not.toHaveProperty('displayName');
  });

  it('se niega a construir la petición si no se aceptaron los términos', () => {
    expect(() => buildRegisterInput({ ...form, acceptTerms: false })).toThrow();
  });
});

describe('registerThenLogin', () => {
  const fetchMock = vi.fn();
  const input = buildRegisterInput({
    displayName: 'Ana',
    email: 'ana@example.com',
    password: 'una-clave-larga-1234',
    acceptTerms: true,
  });

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registra y luego inicia sesión, en ese orden y con los mismos datos', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: '1' }, 201))
      .mockResolvedValueOnce(jsonResponse({ id: '1' }, 200));

    const result = await registerThenLogin(input);

    expect(result).toEqual({ ok: true });
    const calls = fetchMock.mock.calls as Array<[string, RequestInit]>;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe('/api/v1/auth/register');
    expect(JSON.parse(String(calls[0][1].body))).toEqual(input);
    expect(calls[1][0]).toBe('/api/v1/auth/login');
    expect(JSON.parse(String(calls[1][1].body))).toEqual({
      email: input.email,
      password: input.password,
    });
  });

  it('si el registro falla (409), no intenta iniciar sesión', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'El correo ya está registrado' }, 409));

    const result = await registerThenLogin(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (result.ok) throw new Error('Debía fallar');
    expect(result.stage).toBe('register');
    expect(result.error).toBeInstanceOf(ApiError);
    expect(result.error).toMatchObject({ status: 409 });
  });

  it('si el registro funciona pero el inicio de sesión falla, lo indica con el paso login', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: '1' }, 201))
      .mockResolvedValueOnce(jsonResponse({ message: 'Demasiados intentos' }, 429));

    const result = await registerThenLogin(input);

    if (result.ok) throw new Error('Debía fallar');
    expect(result.stage).toBe('login');
    expect(result.error).toMatchObject({ status: 429 });
  });
});