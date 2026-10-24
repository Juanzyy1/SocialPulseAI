import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { originCheckMiddleware } from './common/security/origin-check';
import { FRONTEND_ORIGIN } from './frontend/frontend-origin';

export const API_PREFIX = 'api/v1';

/**
 * Configuración compartida entre main.ts y las pruebas e2e, para que las
 * pruebas ejecuten la app tal como corre en la realidad.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
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