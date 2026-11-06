import { expect, test } from '@playwright/test';
import { IS_HTTPS, warmUp } from './support';

test.describe('cabeceras y rutas de la versión desplegada', () => {
  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(180_000);
    await warmUp();
  });

  test('las páginas solo admiten recursos de su origen, no se indexan y no se pueden meter en un marco', async ({
    request,
  }) => {
    const res = await request.get('/');
    const headers = res.headers();

    expect(res.status()).toBe(200);
    expect(headers['content-security-policy']).toContain("script-src 'self'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-powered-by']).toBeUndefined();
    if (IS_HTTPS) expect(headers['strict-transport-security']).toContain('max-age=');
  });

  test('la API lleva la política estricta y tampoco se indexa', async ({ request }) => {
    const res = await request.get('/api/v1/health');
    const headers = res.headers();

    expect(res.status()).toBe(200);
    expect(headers['content-security-policy']).toContain("default-src 'none'");
    expect(headers['content-security-policy']).not.toContain('script-src');
    expect(headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  test('robots.txt prohíbe la indexación', async ({ request }) => {
    const res = await request.get('/robots.txt');

    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('Disallow: /');
  });

  test('la documentación y los diagnósticos no están expuestos', async ({ request }) => {
    expect((await request.get('/api/docs')).status()).toBe(404);
    expect((await request.get('/api/v1/diagnostics/network')).status()).toBe(404);
  });

  test('la API protegida responde 401 sin sesión y una ruta desconocida da 404 en JSON, no la página', async ({
    request,
  }) => {
    expect((await request.get('/api/v1/users/me')).status()).toBe(401);

    const unknown = await request.get('/api/v1/no-existe');
    expect(unknown.status()).toBe(404);
    expect(unknown.headers()['content-type']).toContain('application/json');
  });

  test('un archivo que no existe da 404 y no la página de la interfaz', async ({ request }) => {
    const res = await request.get('/assets/no-existe.js');

    expect(res.status()).toBe(404);
    expect(await res.text()).not.toContain('<!doctype html');
  });

  test('una petición que modifica datos desde un origen ajeno recibe 403', async ({ request }) => {
    const res = await request.post('/api/v1/auth/login', {
      headers: { Origin: 'http://evil.example' },
      data: { email: 'nadie@socialpulse-e2e.invalid', password: 'incorrecta-123456' },
    });

    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({ message: 'Origen no permitido' });
  });
});