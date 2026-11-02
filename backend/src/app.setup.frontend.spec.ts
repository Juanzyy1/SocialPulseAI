import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../dist/app.setup';
import { FrontendModule } from '../dist/frontend/frontend.module';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { pong: true };
  }
}

const PRODUCTION = { NODE_ENV: 'production', FRONTEND_URL: 'https://app.ejemplo.com', TRUST_PROXY_HOPS: 1 };

describe('configureApp con el frontend compilado', () => {
  const apps: INestApplication<App>[] = [];
  let dist: string;

  beforeAll(() => {
    dist = mkdtempSync(join(tmpdir(), 'setup-dist-'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>INDEX-MARCADOR</title>');
  });
  afterAll(() => rmSync(dist, { recursive: true, force: true }));
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function compile(settings: Record<string, unknown>): Promise<INestApplication<App>> {
    @Module({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, ignoreEnvVars: true, load: [() => settings] }),
        FrontendModule,
      ],
      controllers: [PingController],
    })
    class TestModule {}

    const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile();
    const app = moduleRef.createNestApplication();
    apps.push(app);
    return app;
  }

  async function build(settings: Record<string, unknown>): Promise<INestApplication<App>> {
    const app = await compile(settings);
    configureApp(app);
    await app.init();
    return app;
  }

  it('en producción, las páginas llevan una política que admite sus propios recursos y la API la estricta', async () => {
    const app = await build({ ...PRODUCTION, FRONTEND_DIST_DIR: dist });

    const page = await request(app.getHttpServer()).get('/cuentas').expect(200);
    const api = await request(app.getHttpServer()).get('/api/v1/ping').expect(200);

    expect(page.text).toContain('INDEX-MARCADOR');
    expect(String(page.headers['content-security-policy'])).toContain("script-src 'self'");
    expect(String(page.headers['content-security-policy'])).toContain("frame-ancestors 'none'");
    expect(String(api.headers['content-security-policy'])).toContain("default-src 'none'");
    expect(String(api.headers['content-security-policy'])).not.toContain('script-src');
    expect(page.headers['strict-transport-security']).toBe('max-age=15552000');
  });

  it('sin FRONTEND_DIST_DIR no se sirve ninguna página', async () => {
    const app = await build(PRODUCTION);

    await request(app.getHttpServer()).get('/').expect(404);
  });

  it('si la carpeta del frontend no tiene index.html, la aplicación no arranca', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'setup-empty-'));
    try {
      const app = await compile({ ...PRODUCTION, FRONTEND_DIST_DIR: empty });

      expect(() => configureApp(app)).toThrow(/index\.html/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('en desarrollo, las páginas se sirven sin política de contenido', async () => {
    const app = await build({ NODE_ENV: 'development', FRONTEND_DIST_DIR: dist });

    const page = await request(app.getHttpServer()).get('/').expect(200);

    expect(page.headers['content-security-policy']).toBeUndefined();
    expect(page.headers['strict-transport-security']).toBeUndefined();
  });
});