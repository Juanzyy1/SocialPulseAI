import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import type { SyncRun } from '../api/types';
import {
  describeDisconnectError,
  describeDisconnectResult,
  describeSyncError,
  describeSyncResult,
} from './messages';

const run = (overrides: Partial<SyncRun> = {}): SyncRun => ({
  id: 'ejecucion-1',
  status: 'SUCCEEDED',
  startedAt: '2026-10-29T12:00:00.000Z',
  finishedAt: '2026-10-29T12:00:01.000Z',
  rangeStart: '2026-07-31',
  rangeEnd: '2026-10-29',
  rowsWritten: 699,
  errorMessage: null,
  ...overrides,
});

describe('describeSyncResult', () => {
  it('una sincronización correcta muestra cuántas filas se guardaron y el rango', () => {
    expect(describeSyncResult(run())).toEqual({
      tone: 'success',
      text: 'Sincronización completada: 699 filas guardadas (31 jul 2026 – 29 oct 2026).',
    });
  });

  it('usa el singular con una sola fila', () => {
    expect(describeSyncResult(run({ rowsWritten: 1 })).text).toContain('1 fila guardada');
  });

  it('una sincronización fallida es un error y muestra el motivo del backend', () => {
    expect(
      describeSyncResult(run({ status: 'FAILED', errorMessage: 'YouTube Analytics respondió 403' })),
    ).toEqual({
      tone: 'error',
      text: 'La sincronización falló: YouTube Analytics respondió 403',
    });
  });

  it('un fallo sin motivo lo dice sin inventar uno', () => {
    expect(describeSyncResult(run({ status: 'FAILED', errorMessage: null })).text).toContain(
      'motivo desconocido',
    );
  });

  it('una sincronización en curso es informativa', () => {
    expect(describeSyncResult(run({ status: 'RUNNING' })).tone).toBe('info');
  });
});

describe('describeSyncError', () => {
  it.each([
    [0, 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.'],
    [400, 'Esta plataforma todavía no se puede sincronizar.'],
    [401, 'Tu sesión caducó. Inicia sesión de nuevo.'],
    [404, 'No encontramos esta cuenta. Puede haberse desconectado.'],
    [429, 'Sincronizaste hace menos de un minuto. Espera un momento e inténtalo de nuevo.'],
    [500, 'No se pudo sincronizar. Inténtalo de nuevo.'],
  ])('el estado %i da su mensaje en español', (status, text) => {
    expect(describeSyncError(new ApiError(status, 'texto interno del backend'))).toBe(text);
  });

  it('un 409 por acceso revocado pide reconectar', () => {
    const error = new ApiError(
      409,
      'El acceso a YouTube fue revocado o caducó; vuelve a conectar la cuenta',
    );

    expect(describeSyncError(error)).toContain('Reconéctala');
  });

  it('un 409 por sincronización en curso lo dice', () => {
    const error = new ApiError(409, 'Ya hay una sincronización en curso para esta cuenta');

    expect(describeSyncError(error)).toBe('Ya hay una sincronización en curso para esta cuenta.');
  });

  it('un error que no es de la API da un mensaje genérico y no expone su texto', () => {
    expect(describeSyncError(new Error('contiene un secreto'))).toBe(
      'No se pudo sincronizar. Inténtalo de nuevo.',
    );
  });
});

describe('describeDisconnectResult', () => {
  it('con la revocación confirmada lo dice', () => {
    const notice = describeDisconnectResult({ revokedAtGoogle: true });

    expect(notice.tone).toBe('success');
    expect(notice.text).toContain('revocamos el acceso en Google');
  });

  it('sin confirmación de Google explica qué hacer y no afirma la revocación', () => {
    const notice = describeDisconnectResult({ revokedAtGoogle: false });

    expect(notice.tone).toBe('info');
    expect(notice.text).toContain('No pudimos confirmar la revocación');
    expect(notice.text).toContain('configuración de seguridad');
    expect(notice.text).not.toContain('revocamos el acceso');
  });

  it('ambos casos aclaran que los datos se borraron', () => {
    expect(describeDisconnectResult({ revokedAtGoogle: true }).text).toContain('borraron');
    expect(describeDisconnectResult({ revokedAtGoogle: false }).text).toContain('borrados');
  });
});

describe('describeDisconnectError', () => {
  it.each([
    [0, 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.'],
    [401, 'Tu sesión caducó. Inicia sesión de nuevo.'],
    [404, 'Esta cuenta ya no existe. Actualiza la página.'],
    [500, 'No se pudo desconectar la cuenta. Inténtalo de nuevo.'],
  ])('el estado %i da su mensaje', (status, text) => {
    expect(describeDisconnectError(new ApiError(status, 'texto interno'))).toBe(text);
  });

  it('un error que no es de la API da un mensaje genérico', () => {
    expect(describeDisconnectError(new Error('secreto'))).toBe(
      'No se pudo desconectar la cuenta. Inténtalo de nuevo.',
    );
  });
});