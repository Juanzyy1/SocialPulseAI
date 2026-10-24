/** Token de inyección: origen del frontend (p. ej. http://localhost:5173) o null si no hay. */
export const FRONTEND_ORIGIN = Symbol('FRONTEND_ORIGIN');

/** Rutas del frontend a las que redirige el backend. Son fijas: nunca salen de la petición. */
export const FRONTEND_PATHS = {
  home: '/',
  login: '/login',
  accounts: '/cuentas',
} as const;