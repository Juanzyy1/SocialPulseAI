import { Controller, Get, INestApplication, Module, Req } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './app.setup';
import { FrontendModule } from './frontend/frontend.module';

@Controller('whoami')
class WhoamiController {
  @Get()
  whoami(@Req() req: Request) {
    return { ip: req.ip, protocol: req.protocol };
  }
}

const PRODUCTION = { NODE_ENV: 'production', FRONTEND_URL: 'https://app.ejemplo.com', TRUST_PROXY_HOPS: 1 };

describe('configureApp (sin base de datos)', () => {
  const apps: INestApplication<App>[] = [];

  /** App mínima con los valores indicados; no lee el .env ni las variables del sistema. */
  async function compile(settings: Record<string, unknown>): Promise<INestApplication<App>> {
    @Module({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [() => settings],
        }),
        FrontendModule,
      ],
      controllers: [WhoamiController],
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

  const whoami = (app: INestApplication<App>) => request(app.getHttpServer()).get('/api/v1/whoami');

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  describe('proxies de confianza', () => {
    it('con un proxy de confianza, la IP y el protocolo salen de las cabeceras del proxy', async () => {
      const app = await build(PRODUCTION);

      const res = await whoami(app).set('X-Forwarded-For', '203.0.113.7').set('X-Forwarded-Proto', 'https').expect(200);

      expect(res.body).toEqual({ ip: '203.0.113.7', protocol: 'https' });
    });

    it('con un proxy de confianza, una IP falsificada al principio de la cadena se ignora', async () => {
      const app = await build(PRODUCTION);

      const res = await whoami(app).set('X-Forwarded-For', '1.1.1.1, 203.0.113.7').expect(200);

      expect(res.body.ip).toBe('203.0.113.7');
    });

    it('sin proxies de confianza (0), las cabeceras se ignoran: nadie puede falsificar su IP', async () => {
      const app = await build({ ...PRODUCTION, TRUST_PROXY_HOPS: 0 });

      const res = await whoami(app).set('X-Forwarded-For', '203.0.113.7').set('X-Forwarded-Proto', 'https').expect(200);

      expect(res.body.ip).not.toBe('203.0.113.7');
      expect(res.body.ip).toMatch(/127\.0\.0\.1$/);
      expect(res.body.protocol).toBe('http');
    });

    it('en desarrollo sin indicar nada, tampoco se confía en las cabeceras', async () => {
      const app = await build({ NODE_ENV: 'development' });

      const res = await whoami(app).set('X-Forwarded-For', '203.0.113.7').expect(200);

      expect(res.body.ip).not.toBe('203.0.113.7');
    });
  });

  describe('cabeceras de seguridad', () => {
    it('en producción: política de contenido estricta, HSTS sin subdominios y sin X-Powered-By', async () => {
      const app = await build(PRODUCTION);

      const res = await whoami(app).expect(200);

      const csp = String(res.headers['content-security-policy']);
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toContain('script-src');
      expect(res.headers['strict-transport-security']).toBe('max-age=15552000');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('en desarrollo: sin política de contenido ni HSTS, pero con el resto de las cabeceras', async () => {
      const app = await build({ NODE_ENV: 'development' });

      const res = await whoami(app).expect(200);

      expect(res.headers['content-security-policy']).toBeUndefined();
      expect(res.headers['strict-transport-security']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('arranque en producción', () => {
    it('se niega a arrancar sin FRONTEND_URL ni TRUST_PROXY_HOPS y dice qué falta', async () => {
      const app = await compile({ NODE_ENV: 'production' });

      expect(() => configureApp(app)).toThrow(/Configuración de producción incompleta/);
      expect(() => configureApp(app)).toThrow(/FRONTEND_URL/);
      expect(() => configureApp(app)).toThrow(/TRUST_PROXY_HOPS/);
    });

    it('sí arranca con el valor 0 indicado de forma explícita', async () => {
      await expect(build({ ...PRODUCTION, TRUST_PROXY_HOPS: 0 })).resolves.toBeDefined();
    });

    it('fuera de producción no exige nada', async () => {
      await expect(build({ NODE_ENV: 'development' })).resolves.toBeDefined();
    });
  });
});