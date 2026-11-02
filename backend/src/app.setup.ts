import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { isApiPath, resolveFrontendDist, serveFrontend } from './common/http/spa';
import { helmetOptions } from './common/security/helmet-options';
import { originCheckMiddleware } from './common/security/origin-check';
import { productionProblems } from './config/production-checks';
import { FRONTEND_ORIGIN } from './frontend/frontend-origin';

export const API_PREFIX = 'api/v1';

/**
 * Configuración compartida entre main.ts y las pruebas e2e, para que las
 * pruebas ejecuten la app tal como corre en la realidad.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const production = config.get<string>('NODE_ENV') === 'production';
  const trustProxyHops = config.get<number | undefined>('TRUST_PROXY_HOPS');
  const frontendDist = config.get<string | undefined>('FRONTEND_DIST_DIR');

  // En producción, lo que afecta a la seguridad debe estar indicado de forma explícita.
  if (production) {
    const problems = productionProblems({
      frontendUrl: config.get<string | undefined>('FRONTEND_URL'),
      trustProxyHops,
    });
    if (problems.length > 0) {
      throw new Error(`Configuración de producción incompleta:\n- ${problems.join('\n- ')}`);
    }
  }
  // Si se pidió servir el frontend, debe existir: mejor fallar al arrancar que servir 404.
  const distDir = frontendDist ? resolveFrontendDist(frontendDist) : null;

  const express = app as NestExpressApplication;
  // Cuántos proxies de confianza hay delante: de ahí salen req.ip (límite de intentos, sesiones) y
  // req.protocol. Con 0 las cabeceras X-Forwarded-* se ignoran y nadie puede falsificar su IP.
  express.set('trust proxy', trustProxyHops ?? 0);

  app.setGlobalPrefix(API_PREFIX);

  // Dos políticas de contenido: la estricta de la API (JSON) y otra para las páginas de la interfaz.
  const apiHeaders = helmet(helmetOptions(production, 'api'));
  const pageHeaders = helmet(helmetOptions(production, 'pages'));
  app.use((req: Request, res: Response, next: NextFunction) =>
    (isApiPath(req.path) ? apiHeaders : pageHeaders)(req, res, next),
  );

  if (distDir) serveFrontend(express, distDir);

  app.use(cookieParser());
  // CSRF: defensa en profundidad además de SameSite=Lax.
  app.use(originCheckMiddleware(app.get<string | null>(FRONTEND_ORIGIN)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta propiedades que no están en el DTO
      forbidNonWhitelisted: true, // y responde 400 si llegan
      transform: true, // convierte el JSON en instancia del DTO
    }),
  );
}