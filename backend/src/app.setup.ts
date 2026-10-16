import { INestApplication } from '@nestjs/common';

export const API_PREFIX = 'api/v1';

/**
 * Configuración compartida entre main.ts y las pruebas e2e, para que las
 * pruebas ejecuten la app tal como corre en la realidad.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
}