import { Inject, Injectable } from '@nestjs/common';
import { FRONTEND_ORIGIN } from './frontend-origin';

@Injectable()
export class FrontendRedirects {
  constructor(@Inject(FRONTEND_ORIGIN) private readonly origin: string | null) {}

  /**
   * URL del frontend para una ruta fija, o null si no hay frontend configurado.
   * La ruta debe empezar por una sola barra: así nunca puede apuntar a otro sitio.
   */
  to(path: string, params: Record<string, string> = {}): string | null {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new Error('La ruta del frontend debe empezar por una sola barra');
    }
    if (this.origin === null) return null;

    const url = new URL(path, this.origin);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  }
}