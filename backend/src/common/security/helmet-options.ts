import type helmet from 'helmet';

type HelmetOptions = NonNullable<Parameters<typeof helmet>[0]>;

const HSTS_MAX_AGE_SECONDS = 15_552_000; // 180 días

/**
 * Cabeceras de seguridad. En producción: política de contenido estricta para una API (no carga nada)
 * y HSTS sin incluir subdominios. En desarrollo ambas se desactivan: la interfaz de Swagger usa scripts
 * en línea y HSTS en localhost puede forzar redirecciones no deseadas. El resto de las cabeceras
 * (nosniff, sin X-Powered-By, etc.) quedan con los valores por defecto de la librería.
 */
export function helmetOptions(production: boolean): HelmetOptions {
  return {
    contentSecurityPolicy: production
      ? {
          useDefaults: false,
          directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
        }
      : false,
    strictTransportSecurity: production
      ? { maxAge: HSTS_MAX_AGE_SECONDS, includeSubDomains: false }
      : false,
  };
}