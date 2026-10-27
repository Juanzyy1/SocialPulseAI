/**
 * Versión vigente de los términos y la política de privacidad (fecha del texto: AAAA-MM-DD).
 * Debe coincidir con la que muestra el frontend. Al cambiar el texto se cambian las dos y todos
 * los usuarios tendrán que aceptar de nuevo (la pantalla de aceptación lo exige).
 */
export const CURRENT_TERMS_VERSION = '2026-10-24';

export const TERMS_OUTDATED_MESSAGE =
  'La versión de los términos no está vigente; recarga la página e inténtalo de nuevo';

export function isTermsUpToDate(acceptedVersion: string | null): boolean {
  return acceptedVersion === CURRENT_TERMS_VERSION;
}