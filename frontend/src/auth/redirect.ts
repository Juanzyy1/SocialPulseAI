const MAX_LENGTH = 2000;

/**
 * Ruta interna segura a la que volver tras iniciar sesión. Cualquier valor dudoso devuelve la
 * raíz: nadie debe poder armar un enlace que saque al usuario de la aplicación.
 */
export function safeRedirectPath(from: unknown): string {
  if (typeof from !== 'string' || from === '' || from.length > MAX_LENGTH) return '/';
  if (!from.startsWith('/') || from.startsWith('//') || from.includes('\\')) return '/';
  // Sin caracteres de control (saltos de línea, tabuladores...).
  if ([...from].some((char) => char.charCodeAt(0) < 32)) return '/';
  // No tiene sentido volver a las pantallas de entrada.
  if (from.startsWith('/login') || from.startsWith('/registro')) return '/';
  return from;
}