export interface ProductionSettings {
  frontendUrl: string | undefined;
  trustProxyHops: number | undefined;
}

/**
 * Lo que debe estar configurado de forma explícita para arrancar en producción. Se comprueba al
 * arrancar para fallar pronto y con un mensaje claro, en lugar de funcionar mal en silencio.
 */
export function productionProblems(settings: ProductionSettings): string[] {
  const problems: string[] = [];

  if (!settings.frontendUrl) {
    problems.push(
      'FRONTEND_URL es obligatoria en producción (por ejemplo, https://app.ejemplo.com): sin ella, los accesos con Google y YouTube no vuelven a la aplicación',
    );
  }
  if (settings.trustProxyHops === undefined) {
    problems.push(
      'TRUST_PROXY_HOPS es obligatoria en producción: 0 si la app recibe las peticiones directamente, o el número de proxies que hay delante (normalmente 1). Un valor incorrecto rompe el límite de intentos por IP',
    );
  }
  return problems;
}