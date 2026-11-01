import { describe, expect, it } from 'vitest';
import {
  describeConnectResult,
  parseConnectResult,
  withoutConnectResult,
} from './connect-result';
import type { ConnectReason } from './connect-result';

const parse = (query: string) => parseConnectResult(new URLSearchParams(query));

describe('parseConnectResult', () => {
  it('sin parámetros no hay resultado', () => {
    expect(parse('')).toBeNull();
    expect(parse('period=7d')).toBeNull();
  });

  it('reconoce una conexión correcta', () => {
    expect(parse('youtube=connected')).toEqual({ kind: 'connected' });
  });

  it.each(['rejected', 'unauthorized', 'already_connected', 'google_error', 'unavailable', 'error'])(
    'reconoce el código de error %s',
    (reason) => {
      expect(parse(`youtube=error&reason=${reason}`)).toEqual({ kind: 'error', reason });
    },
  );

  it('un error sin código o con un código desconocido usa el genérico', () => {
    expect(parse('youtube=error')).toEqual({ kind: 'error', reason: 'error' });
    expect(parse('youtube=error&reason=inventado')).toEqual({ kind: 'error', reason: 'error' });
    expect(parse('youtube=error&reason=')).toEqual({ kind: 'error', reason: 'error' });
  });

  it('un código con otra forma (mayúsculas, espacios, HTML) no se acepta como conocido', () => {
    for (const reason of ['REJECTED', ' rejected', 'rejected ', '<script>alert(1)</script>']) {
      const outcome = parseConnectResult(new URLSearchParams({ youtube: 'error', reason }));

      expect(outcome).toEqual({ kind: 'error', reason: 'error' });
    }
  });

  it('un valor desconocido de youtube no es un resultado', () => {
    expect(parse('youtube=otra-cosa')).toBeNull();
    expect(parse('youtube=')).toBeNull();
    expect(parse('youtube=CONNECTED')).toBeNull();
  });

  it('con una conexión correcta se ignora el motivo', () => {
    expect(parse('youtube=connected&reason=rejected')).toEqual({ kind: 'connected' });
  });
});

describe('withoutConnectResult', () => {
  it('quita los dos parámetros y conserva el resto', () => {
    const result = withoutConnectResult(new URLSearchParams('youtube=error&reason=rejected&period=7d'));

    expect(result.toString()).toBe('period=7d');
  });

  it('no modifica los parámetros originales', () => {
    const original = new URLSearchParams('youtube=connected');

    withoutConnectResult(original);

    expect(original.get('youtube')).toBe('connected');
  });

  it('sin esos parámetros no cambia nada', () => {
    expect(withoutConnectResult(new URLSearchParams('a=1')).toString()).toBe('a=1');
  });
});

describe('describeConnectResult', () => {
  it('una conexión correcta es un éxito y pide sincronizar', () => {
    const notice = describeConnectResult({ kind: 'connected' });

    expect(notice.tone).toBe('success');
    expect(notice.text).toContain('sincroniza');
  });

  it('cada código de error tiene su propio mensaje en español', () => {
    const reasons: ConnectReason[] = [
      'rejected',
      'unauthorized',
      'already_connected',
      'google_error',
      'unavailable',
      'error',
    ];
    const texts = reasons.map((reason) => describeConnectResult({ kind: 'error', reason }));

    for (const notice of texts) {
      expect(notice.tone).toBe('error');
      expect(notice.text.trim()).not.toBe('');
    }
    expect(new Set(texts.map((notice) => notice.text)).size).toBe(reasons.length);
  });

  it('el error por canal ya conectado nombra el problema y el de permisos explica qué hacer', () => {
    expect(describeConnectResult({ kind: 'error', reason: 'already_connected' }).text).toContain(
      'otra cuenta',
    );
    expect(describeConnectResult({ kind: 'error', reason: 'rejected' }).text).toContain(
      'dos permisos',
    );
  });
});