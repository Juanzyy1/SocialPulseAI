import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './redirect';

describe('safeRedirectPath', () => {
  it('acepta rutas internas, con parámetros', () => {
    expect(safeRedirectPath('/cuentas')).toBe('/cuentas');
    expect(safeRedirectPath('/cuentas?youtube=connected')).toBe('/cuentas?youtube=connected');
  });

  it('rechaza rutas externas, esquemas y trucos con barras', () => {
    for (const bad of [
      '//evil.example',
      'https://evil.example',
      'javascript:alert(1)',
      '/\\evil.example',
      '/\\/evil.example',
      'cuentas',
    ]) {
      expect(safeRedirectPath(bad)).toBe('/');
    }
  });

  it('rechaza lo que no es texto, lo vacío, lo larguísimo y lo que lleva caracteres de control', () => {
    for (const bad of [undefined, null, 42, {}, '', `/${'a'.repeat(2000)}`, '/ok\nSet-Cookie: x', '/ok\t']) {
      expect(safeRedirectPath(bad)).toBe('/');
    }
  });

  it('no vuelve a las pantallas de entrada', () => {
    for (const path of ['/login', '/login?error=rejected', '/registro', '/registro?x=1']) {
      expect(safeRedirectPath(path)).toBe('/');
    }
  });
});