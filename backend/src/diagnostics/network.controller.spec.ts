import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DiagnosticsModule } from './diagnostics.module';

describe('GET /diagnostics/network', () => {
  const apps: INestApplication<App>[] = [];

  async function build(settings: Record<string, unknown>): Promise<INestApplication<App>> {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, ignoreEnvVars: true, load: [() => settings] }),
        DiagnosticsModule,
      ],
    }).compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api/v1');
    app.set('trust proxy', Number(settings.TRUST_PROXY_HOPS ?? 0));
    await app.init();
    apps.push(app);
    return app;
  }

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  const get = (app: INestApplication<App>) => request(app.getHttpServer()).get('/api/v1/diagnostics/network');

  it('apagado (por defecto) responde 404', async () => {
    await get(await build({})).expect(404);
    await get(await build({ EXPOSE_NETWORK_DIAGNOSTICS: false })).expect(404);
  });

  it('encendido muestra la IP, el protocolo y las cabeceras de reenvío que recibe', async () => {
    const app = await build({ EXPOSE_NETWORK_DIAGNOSTICS: true, TRUST_PROXY_HOPS: 1 });

    const res = await get(app).set('X-Forwarded-For', '1.1.1.1, 203.0.113.7').set('X-Forwarded-Proto', 'https').expect(200);

    expect(res.body).toEqual({
      ip: '203.0.113.7',
      protocol: 'https',
      forwardedFor: '1.1.1.1, 203.0.113.7',
      forwardedProto: 'https',
      trustProxyHops: 1,
    });
  });

  it('sin proxies de confianza ignora las cabeceras para la IP, pero las muestra tal como llegan', async () => {
    const app = await build({ EXPOSE_NETWORK_DIAGNOSTICS: true });

    const res = await get(app).set('X-Forwarded-For', '203.0.113.7').expect(200);

    expect(res.body.ip).not.toBe('203.0.113.7');
    expect(res.body.forwardedFor).toBe('203.0.113.7');
    expect(res.body.trustProxyHops).toBe(0);
  });

  it('solo devuelve esos campos: nunca cookies ni cabeceras de autorización', async () => {
    const app = await build({ EXPOSE_NETWORK_DIAGNOSTICS: true });

    const res = await get(app).set('Cookie', 'sp_session=secreto').set('Authorization', 'Bearer secreto').expect(200);

    expect(Object.keys(res.body).sort()).toEqual(['forwardedFor', 'forwardedProto', 'ip', 'protocol', 'trustProxyHops']);
    expect(JSON.stringify(res.body)).not.toContain('secreto');
  });
});