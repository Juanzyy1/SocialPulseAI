import { FrontendRedirects } from './frontend-redirects';

const redirects = new FrontendRedirects('http://localhost:5173');

describe('FrontendRedirects', () => {
  it('construye la URL con la ruta y los parámetros', () => {
    expect(redirects.to('/cuentas', { youtube: 'connected' })).toBe(
      'http://localhost:5173/cuentas?youtube=connected',
    );
    expect(redirects.to('/login', { error: 'rejected' })).toBe(
      'http://localhost:5173/login?error=rejected',
    );
  });

  it('sin parámetros devuelve solo la ruta', () => {
    expect(redirects.to('/')).toBe('http://localhost:5173/');
  });

  it('codifica los valores de los parámetros', () => {
    expect(redirects.to('/login', { error: 'a b&c' })).toBe(
      'http://localhost:5173/login?error=a+b%26c',
    );
  });

  it('sin frontend configurado devuelve null', () => {
    expect(new FrontendRedirects(null).to('/cuentas', { youtube: 'connected' })).toBeNull();
  });

  it('rechaza rutas que podrían apuntar a otro sitio, también sin frontend configurado', () => {
    for (const bad of ['//evil.example', 'https://evil.example', 'cuentas', '']) {
      expect(() => redirects.to(bad)).toThrow();
      expect(() => new FrontendRedirects(null).to(bad)).toThrow();
    }
  });
});