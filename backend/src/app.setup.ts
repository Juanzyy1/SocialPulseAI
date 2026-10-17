import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

export const API_PREFIX = 'api/v1';

/**
 * Configuración compartida entre main.ts y las pruebas e2e, para que las
 * pruebas ejecuten la app tal como corre en la realidad.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta propiedades que no están en el DTO
      forbidNonWhitelisted: true, // y responde 400 si llegan
      transform: true, // convierte el JSON en instancia del DTO
    }),
  );
}