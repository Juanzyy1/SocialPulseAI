import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface OriginCheckInput {
  method: string;
  /** Valor del encabezado Origin, o undefined si no viene. */
  origin: string | undefined;
  /** Origen del propio servidor según la petición (esquema y host). */
  hostOrigin: string;
  /** Origen del frontend configurado, o null. */
  frontendOrigin: string | null;
}

/**
 * Defensa contra CSRF además de SameSite=Lax. Solo mira las peticiones que modifican datos.
 * Sin encabezado Origin se permite: un navegador siempre lo envía al modificar datos desde
 * otro sitio, así que su ausencia indica un cliente que no es una página (curl, otro servidor).
 */
export function isOriginAllowed(input: OriginCheckInput): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return true;
  if (input.origin === undefined) return true;
  return (
    input.origin === input.hostOrigin ||
    (input.frontendOrigin !== null && input.origin === input.frontendOrigin)
  );
}

export function originCheckMiddleware(frontendOrigin: string | null) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const allowed = isOriginAllowed({
      method: req.method,
      origin: req.get('origin'),
      hostOrigin: `${req.protocol}://${req.get('host') ?? ''}`,
      frontendOrigin,
    });
    if (allowed) {
      next();
      return;
    }
    res.status(403).json({ statusCode: 403, message: 'Origen no permitido', error: 'Forbidden' });
  };
}