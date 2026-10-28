import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { usersApi } from '../api/endpoints';
import type { Profile } from '../api/types';
import { TERMS_VERSION } from './terms';
import { buildTermsAcceptance, describeTermsError, termsGateMode } from './terms-gate';

const profile = (overrides: Partial<Profile> = {}): Profile => ({
  id: '77c69fe0-cfa1-44f6-a43d-cf33ae48cc89',
  email: 'ana@example.com',
  displayName: 'Ana',
  createdAt: '2026-10-24T00:00:00.000Z',
  avatarUrl: null,
  emailVerifiedAt: null,
  termsAcceptedAt: null,
  termsVersion: null,
  termsUpToDate: false,
  currentTermsVersion: TERMS_VERSION,
  ...overrides,
});

describe('termsGateMode', () => {
  it('sin sesión (null o undefined) no hay puerta', () => {
    expect(termsGateMode(null)).toBe('none');
    expect(termsGateMode(undefined)).toBe('none');
  });

  it('con los términos al día no hay puerta', () => {
    expect(termsGateMode(profile({ termsUpToDate: true }))).toBe('none');
  });

  it('sin aceptar y con la misma versión, hay que aceptar', () => {
    expect(termsGateMode(profile())).toBe('accept');
  });

  it('sin aceptar y con otra versión en el backend, hay que recargar la página', () => {
    expect(termsGateMode(profile({ currentTermsVersion: '2099-01-01' }))).toBe('reload');
  });
});

describe('buildTermsAcceptance', () => {
  it('acepta la versión del texto que muestra esta página', () => {
    expect(buildTermsAcceptance()).toEqual({ acceptTerms: true, termsVersion: TERMS_VERSION });
  });
});

describe('describeTermsError', () => {
  it.each([
    [0, 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.'],
    [401, 'Tu sesión caducó. Inicia sesión de nuevo.'],
    [500, 'No se pudo registrar tu aceptación. Inténtalo de nuevo.'],
    [418, 'No se pudo registrar tu aceptación. Inténtalo de nuevo.'],
  ])('el estado %i da su mensaje', (status, message) => {
    expect(describeTermsError(new ApiError(status, 'texto interno'))).toBe(message);
  });

  it('un 400 por versión no vigente muestra el aviso del backend', () => {
    const outdated = new ApiError(
      400,
      'La versión de los términos no está vigente; recarga la página e inténtalo de nuevo',
    );

    expect(describeTermsError(outdated)).toBe(outdated.message);
  });

  it('un error que no es de la API da un mensaje genérico y no expone su texto', () => {
    expect(describeTermsError(new Error('contiene un secreto'))).toBe(
      'Ocurrió un error inesperado. Inténtalo de nuevo.',
    );
  });
});

describe('usersApi.acceptTerms', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envía la aceptación a POST /users/me/terms y devuelve el perfil actualizado', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(profile({ termsUpToDate: true })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await usersApi.acceptTerms(buildTermsAcceptance());

    expect(result.termsUpToDate).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/users/me/terms');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ acceptTerms: true, termsVersion: TERMS_VERSION });
  });
});