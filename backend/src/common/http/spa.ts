import { existsSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

/** true si la ruta pertenece a la API: la interfaz nunca la sirve. */
export function isApiPath(path: string): boolean {
  return path === '/api' || path.startsWith('/api/');
}

/** Ruta absoluta de la carpeta del frontend compilado; falla pronto si no contiene index.html. */
export function resolveFrontendDist(dir: string): string {
  const absolute = resolve(dir);
  if (!existsSync(join(absolute, 'index.html'))) {
    throw new Error(
      'FRONTEND_DIST_DIR no contiene el frontend compilado (falta index.html): ejecuta "npm run build" en frontend',
    );
  }
  return absolute;
}

/**
 * Sirve el frontend compilado: archivos estáticos y, para las rutas del cliente (/cuentas, /resumen...),
 * index.html. Un archivo que no existe da 404 (no la página), y la API y los métodos que no son de
 * lectura nunca reciben index.html. Los archivos ocultos y las rutas con ".." no se sirven.
 */
export function serveFrontend(app: NestExpressApplication, distDir: string): void {
  app.useStaticAssets(distDir, {
    index: false,
    setHeaders: (res: Response, filePath: string) => {
      // Los archivos de assets/ llevan un hash en el nombre: se pueden guardar un año.
      const hashed = filePath.includes(`${sep}assets${sep}`);
      res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  });

  const index = join(distDir, 'index.html');
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (isApiPath(req.path)) return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (extname(req.path) !== '') return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
}