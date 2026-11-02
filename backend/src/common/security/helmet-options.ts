import type helmet from 'helmet';

type HelmetOptions = NonNullable<Parameters<typeof helmet>[0]>;

const HSTS_MAX_AGE_SECONDS = 15_552_000; // 180 días

/** Qué respuestas protege: las de la API (JSON) o las páginas de la interfaz (HTML, CSS y JS). */
export type HelmetScope = 'api' | 'pages';

/** La interfaz solo carga recursos de su propio origen: sin scripts ni estilos en línea, sin marcos. */
const PAGES_DIRECTIVES = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  imgSrc: ["'self'", 'data:'],
  fontSrc: ["'self'"],
  connectSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
};

/**
 * Cabeceras de seguridad. En producción: para la API, una política de contenido estricta (no carga nada);
 * para las páginas, una que solo admite recursos del propio origen; y HSTS sin incluir subdominios. En
 * desarrollo la política y HSTS se desactivan: la interfaz de Swagger usa scripts en línea y HSTS en
 * localhost puede forzar redirecciones no deseadas. El resto de las cabeceras queda con los valores por
 * defecto de la librería.
 */
export function helmetOptions(production: boolean, scope: HelmetScope = 'api'): HelmetOptions {
  const directives =
    scope === 'api' ? { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } : PAGES_DIRECTIVES;

  return {
    contentSecurityPolicy: production ? { useDefaults: false, directives } : false,
    strictTransportSecurity: production
      ? { maxAge: HSTS_MAX_AGE_SECONDS, includeSubDomains: false }
      : false,
  };
}