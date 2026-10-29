import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { metricsOf } from '../src/analytics/metric-catalog';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RATE_LIMIT_CONFIG } from '../src/auth/rate-limit.config';
import { PrismaService } from '../src/prisma/prisma.service';
import { PERMISSIVE_RATE_LIMITS } from './helpers/rate-limits';
import { registerAndLogin } from './helpers/session';

// Dominio .invalid: reservado, nunca es un correo real.
const TEST_DOMAIN = '@analytics-catalog-test.invalid';

interface CatalogMetric {
  code: string;
  label: string;
  polarity: string;
  note: string | null;
}

describe('Catálogo de métricas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RATE_LIMIT_CONFIG)
      .useValue(PERMISSIVE_RATE_LIMITS)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
    await app.close();
  });

  it('sin sesión responde 401', async () => {
    await api().get('/api/v1/analytics/metrics').expect(401);
  });

  it('devuelve el catálogo de YouTube completo y en orden, con etiquetas, polaridad y advertencias', async () => {
    const user = await registerAndLogin(app, TEST_DOMAIN);

    const res = await api().get('/api/v1/analytics/metrics').set('Cookie', user.cookie).expect(200);

    expect(res.body.platforms.map((p: { platform: string }) => p.platform)).toEqual(['YOUTUBE']);
    const metrics: CatalogMetric[] = res.body.platforms[0].metrics;
    expect(metrics.map((m) => m.code)).toEqual(metricsOf('YOUTUBE').map((m) => m.code));

    const byCode = (code: string): CatalogMetric => {
      const found = metrics.find((m) => m.code === code);
      if (!found) throw new Error(`No hay ${code}`);
      return found;
    };
    expect(byCode('views')).toMatchObject({ label: 'Vistas', polarity: 'higher_is_better', note: null });
    expect(byCode('subscribersLost')).toMatchObject({
      label: 'Suscriptores perdidos',
      polarity: 'lower_is_better',
    });
    expect(byCode('estimatedMinutesWatched').note).toContain('enteros');
  });

  it('no expone datos internos de agregación', async () => {
    const user = await registerAndLogin(app, TEST_DOMAIN);

    const res = await api().get('/api/v1/analytics/metrics').set('Cookie', user.cookie).expect(200);

    for (const metric of res.body.platforms[0].metrics) {
      expect(Object.keys(metric).sort()).toEqual(['code', 'kind', 'label', 'note', 'polarity', 'unit']);
    }
    expect(JSON.stringify(res.body)).not.toContain('compatibleGroup');
    expect(JSON.stringify(res.body)).not.toContain('weightedBy');
  });
});