import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { usersApi } from '../api/endpoints';
import {
  buildDeleteInput,
  deleteFormErrors,
  describeDeleteAccountError,
  describeDeletion,
  isDeleteResult,
} from './delete-account';

const withPassword = { email: 'Ana@Example.com', hasPassword: true };
const googleOnly = { email: 'ana@example.com', hasPassword: false };

describe('deleteFormErrors', () => {
  it('un formulario correcto no tiene errores, sin distinguir mayúsculas ni espacios en el correo', () => {
    expect(deleteFormErrors({ confirmEmail: '  ana@example.COM ', password: 'x' }, withPassword)).toEqual({});
  });

  it('un correo distinto se marca', () => {
    expect(deleteFormErrors({ confirmEmail: 'otra@example.com', password: 'x' }, withPassword)).toEqual({
      confirmEmail: 'Escribe tu correo exactamente como aparece arriba',
    });
  });

  it('con contraseña en la cuenta, la contraseña es obligatoria; si no la tiene, no se pide', () => {
    expect(deleteFormErrors({ confirmEmail: 'ana@example.com', password: '' }, withPassword)).toEqual({
      password: 'Escribe tu contraseña para confirmar',
    });
    expect(deleteFormErrors({ confirmEmail: 'ana@example.com', password: '' }, googleOnly)).toEqual({});
  });

  it('informa los dos campos a la vez', () => {
    const errors = deleteFormErrors({ confirmEmail: '', password: '' }, withPassword);

    expect(Object.keys(errors).sort()).toEqual(['confirmEmail', 'password']);
  });
});

describe('buildDeleteInput', () => {
  it('recorta el correo, no la contraseña, y la incluye solo si la cuenta tiene una', () => {
    expect(buildDeleteInput({ confirmEmail: ' ana@example.com ', password: ' clave con espacios ' }, withPassword)).toEqual({
      confirmEmail: 'ana@example.com',
      password: ' clave con espacios ',
    });
    expect(buildDeleteInput({ confirmEmail: 'ana@example.com', password: 'lo-que-sea' }, googleOnly)).toEqual({
      confirmEmail: 'ana@example.com',
    });
  });
});

describe('describeDeleteAccountError', () => {
  it.each([
    [0, 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.'],
    [401, 'Tu sesión caducó. Inicia sesión de nuevo.'],
    [403, 'Los datos de confirmación no son correctos.'],
    [429, 'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentarlo.'],
    [500, 'No se pudo eliminar la cuenta. Inténtalo de nuevo.'],
  ])('el estado %i da su mensaje', (status, text) => {
    expect(describeDeleteAccountError(new ApiError(status, 'texto interno'))).toBe(text);
  });

  it('un error que no es de la API da un mensaje genérico y no expone su texto', () => {
    expect(describeDeleteAccountError(new Error('secreto'))).toBe('Ocurrió un error inesperado. Inténtalo de nuevo.');
  });
});

describe('isDeleteResult y describeDeletion', () => {
  it('reconoce un resultado válido y rechaza formas inesperadas', () => {
    expect(isDeleteResult({ accountsDisconnected: 1, revocationsNotConfirmed: 0 })).toBe(true);
    for (const bad of [null, undefined, 'x', 5, {}, { accountsDisconnected: 1 }, { accountsDisconnected: '1', revocationsNotConfirmed: 0 }, { accountsDisconnected: -1, revocationsNotConfirmed: 0 }]) {
      expect(isDeleteResult(bad)).toBe(false);
    }
  });

  it('sin canales conectados o sin resultado, el mensaje es simple', () => {
    expect(describeDeletion(null)).toEqual({ text: 'Tu cuenta y todos sus datos se eliminaron.', warning: false });
    expect(describeDeletion({ accountsDisconnected: 0, revocationsNotConfirmed: 0 }).warning).toBe(false);
  });

  it('con todas las revocaciones confirmadas lo dice', () => {
    const outcome = describeDeletion({ accountsDisconnected: 2, revocationsNotConfirmed: 0 });

    expect(outcome.text).toContain('se revocó el acceso a tus canales en Google');
    expect(outcome.warning).toBe(false);
  });

  it('si alguna no se confirmó, avisa con singular o plural y no afirma que se revocó', () => {
    const one = describeDeletion({ accountsDisconnected: 1, revocationsNotConfirmed: 1 });
    const two = describeDeletion({ accountsDisconnected: 3, revocationsNotConfirmed: 2 });

    expect(one.text).toContain('de 1 cuenta:');
    expect(two.text).toContain('de 2 cuentas:');
    expect(one.text).toContain('configuración de seguridad');
    expect(one.text).not.toContain('se revocó el acceso');
    expect(one.warning).toBe(true);
  });
});

describe('usersApi.deleteAccount', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envía POST /users/me/delete con la confirmación', async () => {
    await usersApi.deleteAccount({ confirmEmail: 'ana@example.com', password: 'clave' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/users/me/delete');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ confirmEmail: 'ana@example.com', password: 'clave' });
  });
});