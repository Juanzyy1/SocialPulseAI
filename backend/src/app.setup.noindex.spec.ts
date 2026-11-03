import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './app.setup';
import { FrontendModule } from './frontend/frontend.module';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { pong: true };
  }
}

describe('configureApp: que los buscadores no indexen', () => {
  const apps: INestApplication<App>[] = [];

  async function build(settings: Record<string, unknown>): Promise<INestApplication<App>> {
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
    configureApp(app);
    await app.init();
    return app;
  }

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it.each([
    ['producción', { NODE_ENV: 'production', FRONTEND_URL: 'https://app.ejemplo.com', TRUST_PROXY_HOPS: 2 }],
    ['desarrollo', { NODE_ENV: 'development' }],
  ])('en %s, las respuestas de la API llevan noindex y nofollow', async (_name, settings) => {
    const app = await build(settings);

    const res = await request(app.getHttpServer()).get('/api/v1/ping').expect(200);

    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
  });
});