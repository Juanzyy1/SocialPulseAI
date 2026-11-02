import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { isApiPath, resolveFrontendDist, serveFrontend } from './spa';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { pong: true };
  }
}

describe('isApiPath', () => {
  it('reconoce las rutas de la API y no confunde otras', () => {
    expect(isApiPath('/api')).toBe(true);
    expect(isApiPath('/api/v1/health')).toBe(true);
    for (const path of ['/', '/cuentas', '/apiary', '/api-docs', '/assets/api/x.js']) {
      expect(isApiPath(path)).toBe(false);
    }
  });
});

describe('serveFrontend', () => {
  let root: string;
  let dist: string;
  let app: NestExpressApplication;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'spa-test-'));
    dist = join(root, 'dist');
    mkdirSync(join(dist, 'assets'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>INDEX-MARCADOR</title>');
    writeFileSync(join(dist, 'assets', 'app-abc123.js'), 'console.log("ASSET-MARCADOR");');
    writeFileSync(join(dist, 'robots.txt'), 'User-agent: *');
    writeFileSync(join(dist, '.env'), 'SECRETO-NO-PUBLICO=1');
    writeFileSync(join(root, 'secreto.txt'), 'SECRETO-FUERA-DE-DIST');

    const moduleRef = await Test.createTestingModule({ controllers: [PingController] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api/v1');
    serveFrontend(app, dist);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });

  const get = (path: string) => request(app.getHttpServer()).get(path);

  it('la raíz y las rutas del cliente devuelven index.html sin caché, con sus parámetros', async () => {
    for (const path of ['/', '/cuentas', '/resumen?period=7d', '/ruta/profunda/del/cliente']) {
      const res = await get(path).expect(200);

      expect(res.text).toContain('INDEX-MARCADOR');
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.headers['cache-control']).toBe('no-cache');
    }
  });

  it('los archivos con hash se sirven con caché de un año', async () => {
    const res = await get('/assets/app-abc123.js').expect(200);

    expect(res.text).toContain('ASSET-MARCADOR');
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('otros archivos de la carpeta se sirven sin caché', async () => {
    const res = await get('/robots.txt').expect(200);

    expect(res.text).toBe('User-agent: *');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('un archivo que no existe da 404 y no la página de la interfaz', async () => {
    const res = await get('/assets/no-existe.js').expect(404);

    expect(res.text).not.toContain('INDEX-MARCADOR');
  });

  it('la API nunca recibe index.html: responde lo suyo, y una ruta desconocida da 404 en JSON', async () => {
    expect((await get('/api/v1/ping').expect(200)).body).toEqual({ pong: true });

    const unknown = await get('/api/v1/no-existe').expect(404);
    expect(unknown.headers['content-type']).toContain('application/json');
    expect(unknown.text).not.toContain('INDEX-MARCADOR');
  });

  it('los métodos que no son de lectura no reciben la página', async () => {
    await request(app.getHttpServer()).post('/cuentas').expect(404);
  });

  it('no sirve archivos de fuera de la carpeta ni archivos ocultos', async () => {
    for (const path of ['/%2e%2e/secreto.txt', '/..%2fsecreto.txt', '/%2e%2e%2fsecreto.txt']) {
      const res = await get(path);

      expect(res.text).not.toContain('SECRETO-FUERA-DE-DIST');
    }
    const hidden = await get('/.env');
    expect(hidden.text).not.toContain('SECRETO-NO-PUBLICO');
  });
});

describe('resolveFrontendDist', () => {
  it('devuelve la ruta absoluta si hay index.html y falla con un mensaje claro si no lo hay', () => {
    const dir = mkdtempSync(join(tmpdir(), 'spa-dist-'));
    try {
      expect(() => resolveFrontendDist(dir)).toThrow(/index\.html/);

      writeFileSync(join(dir, 'index.html'), '<html></html>');
      expect(resolveFrontendDist(dir)).toBe(resolve(dir));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});