import { ApiError } from '../api/client';
import type { RegisterFlowFailure } from './auth-flows';

/** Mensaje para el usuario según el error de la API. */
export function describeAuthError(error: unknown, flow: 'login' | 'register'): string {
  if (!(error instanceof ApiError)) return 'Ocurrió un error inesperado. Inténtalo de nuevo.';

  switch (error.status) {
    case 0:
      return 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
    case 400:
      // El backend avisa con un mensaje propio cuando la versión de los términos ya no es la vigente.
      return flow === 'register' && error.message.includes('vigente')
        ? error.message
        : 'Revisa los datos e inténtalo de nuevo.';
    case 401:
      return 'El correo o la contraseña no son correctos.';
    case 403:
      return 'No se pudo completar la solicitud desde este sitio. Recarga la página e inténtalo de nuevo.';
    case 409:
      return 'Ya existe una cuenta con ese correo. Prueba a iniciar sesión.';
    case 429:
      return 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.';
    default:
      return error.status >= 500
        ? 'El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.'
        : 'No se pudo completar la solicitud.';
  }
}

/** Mensaje cuando el registro o el inicio de sesión posterior falla. */
export function registerFailureMessage(failure: RegisterFlowFailure): string {
  if (failure.stage === 'login') {
    return 'Tu cuenta se creó, pero no pudimos iniciar sesión automáticamente. Entra con tu correo y tu contraseña desde la pantalla de inicio de sesión.';
  }
  return describeAuthError(failure.error, 'register');
}

/** Mensaje para el código `?error=` con el que el backend devuelve a /login tras un fallo con Google. */
export function describeOAuthLoginError(code: string | null): string | null {
  if (code === null) return null;
  switch (code) {
    case 'rejected':
      return 'No se pudo completar el acceso con Google. Inténtalo de nuevo.';
    case 'unauthorized':
      return 'No se pudo verificar tu identidad con Google. Inténtalo de nuevo.';
    case 'google_error':
      return 'Hubo un problema al comunicarse con Google. Inténtalo de nuevo en unos minutos.';
    case 'unavailable':
      return 'El acceso con Google no está disponible en este momento.';
    default:
      return 'No se pudo completar el acceso con Google.';
  }
}